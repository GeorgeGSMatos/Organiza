using System;
using System.IO;
using System.Collections.Generic;
using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Win32.SafeHandles;

public sealed class TransferFault : Exception {
    public string Code;
    public TransferFault(string code, string message) : base(message) { Code = code; }
}
public sealed class TransferSnapshot {
    public long size;
    public double mtimeMs;
    public string hash;
    public string identity;
    public string method;
}
public static class SafeTransfer {
    [StructLayout(LayoutKind.Sequential)] struct FT { public uint Low, High; }
    [StructLayout(LayoutKind.Sequential)] struct Info {
        public uint Attributes; public FT Creation, Access, Write; public uint Volume, SizeHigh, SizeLow, Links, IndexHigh, IndexLow;
    }
    [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern SafeFileHandle CreateFileW(string name, uint access, uint share, IntPtr security, uint disposition, uint flags, IntPtr template);
    [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern uint GetFileAttributesW(string name);
    [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern bool CreateDirectoryW(string name, IntPtr security);
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool GetFileInformationByHandle(SafeFileHandle file, out Info info);
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool SetFileInformationByHandle(SafeFileHandle file, int kind, IntPtr data, uint size);
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool SetFilePointerEx(SafeFileHandle file, long distance, out long position, uint method);
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool ReadFile(SafeFileHandle file, byte[] buffer, uint count, out uint read, IntPtr overlapped);
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool FlushFileBuffers(SafeFileHandle file);
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool SetFileTime(SafeFileHandle file, ref FT creation, IntPtr access, ref FT write);
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool BackupRead(SafeFileHandle file, byte[] buffer, uint count, out uint read, bool abort, bool security, ref IntPtr context);
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool BackupWrite(SafeFileHandle file, byte[] buffer, uint count, out uint written, bool abort, bool security, ref IntPtr context);
    static SafeFileHandle source;
    static readonly List<SafeFileHandle> directories = new List<SafeFileHandle>();
    static string destination, preparedHash;
    static Info original;
    const uint REPARSE=0x400, OFFLINE=0x1000, RECALL_OPEN=0x40000, RECALL_DATA=0x400000;
    static string Extended(string name) { return name.StartsWith(@"\\") ? @"\\?\UNC\" + name.Substring(2) : @"\\?\" + name; }
    static TransferFault WinError(string operation) {
        int error=Marshal.GetLastWin32Error();
        string code=(error==80 || error==183) ? "collision" : (error==32 || error==33) ? "busy" : error==5 ? "permission" : "native";
        return new TransferFault(code, operation + " (Windows " + error + "): " + new Win32Exception(error).Message);
    }
    static Info Information(SafeFileHandle handle) { Info info; if(!GetFileInformationByHandle(handle,out info)) throw WinError("Falha ao verificar o arquivo"); return info; }
    static double TimeMs(FT time) { return (DateTime.FromFileTimeUtc(((long)time.High<<32)|time.Low)-new DateTime(1970,1,1,0,0,0,DateTimeKind.Utc)).TotalMilliseconds; }
    static TransferSnapshot Snapshot(Info info, string hash) { return new TransferSnapshot { size=((long)info.SizeHigh<<32)|info.SizeLow, mtimeMs=TimeMs(info.Write), hash=hash, identity=info.Volume.ToString("x8")+":"+info.IndexHigh.ToString("x8")+info.IndexLow.ToString("x8") }; }
    static void CheckAttributes(uint attributes) {
        if((attributes & (REPARSE|OFFLINE|RECALL_OPEN|RECALL_DATA))!=0) throw new TransferFault("cloud", "Arquivo ou pasta com sinais de placeholder, atalho ou conteúdo pendente. Disponibilize uma cópia local antes de organizar.");
        if((attributes & (1|4|16))!=0) throw new TransferFault("protected", "Arquivo protegido, somente leitura ou não regular; mantido para revisão.");
    }
    static string Hash(SafeFileHandle handle) {
        long position; if(!SetFilePointerEx(handle,0,out position,0)) throw WinError("Não foi possível ler para conferir o arquivo");
        using(SHA256 hash=SHA256.Create()) {
            byte[] buffer=new byte[1024*1024]; uint count;
            while(true) { if(!ReadFile(handle,buffer,(uint)buffer.Length,out count,IntPtr.Zero)) throw WinError("Falha ao conferir o conteúdo"); if(count==0) break; hash.TransformBlock(buffer,0,(int)count,buffer,0); }
            hash.TransformFinalBlock(new byte[0],0,0);
            if(!SetFilePointerEx(handle,0,out position,0)) throw WinError("Falha ao reposicionar o arquivo");
            return BitConverter.ToString(hash.Hash).Replace("-", "").ToLowerInvariant();
        }
    }
    static void LockDirectories(string directory, bool create) {
        List<string> chain=new List<string>(); string current=directory; string root=Path.GetPathRoot(directory).TrimEnd('\\');
        while(!String.IsNullOrEmpty(current)) { chain.Add(current); if(String.Equals(current.TrimEnd('\\'),root,StringComparison.OrdinalIgnoreCase)) break; string parent=Path.GetDirectoryName(current); if(parent==current) break; current=parent; }
        chain.Reverse();
        foreach(string part in chain) {
            uint attributes=GetFileAttributesW(Extended(part));
            if(attributes==UInt32.MaxValue) {
                int error=Marshal.GetLastWin32Error();
                if(!create || (error!=2 && error!=3)) throw WinError("Pasta indisponível");
                if(!CreateDirectoryW(Extended(part),IntPtr.Zero) && Marshal.GetLastWin32Error()!=183) throw WinError("Não foi possível criar o destino");
            }
            SafeFileHandle handle=CreateFileW(Extended(part),0x80,3,IntPtr.Zero,3,0x02000000|0x00200000,IntPtr.Zero);
            if(handle.IsInvalid) { handle.Dispose(); throw WinError("Não foi possível proteger o caminho da pasta"); }
            directories.Add(handle); Info info=Information(handle);
            if((info.Attributes & (REPARSE|OFFLINE|RECALL_OPEN|RECALL_DATA))!=0 || (info.Attributes & 16)==0) throw new TransferFault("path", "O caminho passa por um atalho ou pasta indisponível; operação recusada.");
        }
    }
    public static TransferSnapshot Prepare(string from, string to, long expectedSize, double expectedMtime, string expectedHash) {
        if(source!=null) throw new TransferFault("busy", "Outra movimentação está sendo preparada.");
        try {
            from=Path.GetFullPath(from); to=Path.GetFullPath(to);
            if(String.Equals(from,to,StringComparison.OrdinalIgnoreCase)) throw new TransferFault("path", "Origem e destino são iguais.");
            LockDirectories(Path.GetDirectoryName(from),false);
            uint attributes=GetFileAttributesW(Extended(from)); if(attributes==UInt32.MaxValue) throw WinError("Arquivo indisponível"); CheckAttributes(attributes);
            source=CreateFileW(Extended(from),0x80000000|0x10000,0,IntPtr.Zero,3,0x00200000|0x08000000,IntPtr.Zero);
            if(source.IsInvalid) throw WinError("Arquivo em uso ou sem permissão");
            original=Information(source); CheckAttributes(original.Attributes);
            TransferSnapshot snap=Snapshot(original,null);
            if(snap.size!=expectedSize || Math.Abs(snap.mtimeMs-expectedMtime)>1) throw new TransferFault("changed", "O arquivo mudou desde a prévia. Atualize a análise.");
            preparedHash=Hash(source);
            if(!String.IsNullOrEmpty(expectedHash) && preparedHash!=expectedHash) throw new TransferFault("changed", "O conteúdo foi alterado. A operação foi recusada.");
            LockDirectories(Path.GetDirectoryName(to),true);
            // Existence is checked by the final native no-replace operation as well.
            if(GetFileAttributesW(Extended(to))!=UInt32.MaxValue) throw new TransferFault("collision", "O destino ficou ocupado. Nenhum arquivo foi substituído.");
            destination=to; snap.hash=preparedHash; return snap;
        } catch { Abort(); throw; }
    }
    static bool RenameLocked(string to) {
        byte[] name=Encoding.Unicode.GetBytes(to); int offset=IntPtr.Size==8 ? 20 : 12;
        int length=offset+name.Length+2; IntPtr buffer=Marshal.AllocHGlobal(length);
        try {
            Marshal.Copy(new byte[length],0,buffer,length); // ReplaceIfExists is FALSE.
            Marshal.WriteIntPtr(buffer,IntPtr.Size==8 ? 8 : 4,IntPtr.Zero);
            Marshal.WriteInt32(buffer,IntPtr.Size==8 ? 16 : 8,name.Length); Marshal.Copy(name,0,IntPtr.Add(buffer,offset),name.Length);
            if(SetFileInformationByHandle(source,3,buffer,(uint)length)) return true;
            int error=Marshal.GetLastWin32Error(); if(error==17) return false;
            throw WinError("Não foi possível mover sem substituir o destino");
        } finally { Marshal.FreeHGlobal(buffer); }
    }
    static void MarkDelete(SafeFileHandle handle) {
        IntPtr value=Marshal.AllocHGlobal(1);
        try { Marshal.WriteByte(value,1); if(!SetFileInformationByHandle(handle,4,value,1)) throw WinError("Não foi possível concluir a remoção da origem"); }
        finally { Marshal.FreeHGlobal(value); }
    }
    static void CopyAllStreams(SafeFileHandle output) {
        IntPtr readContext=IntPtr.Zero, writeContext=IntPtr.Zero; byte[] buffer=new byte[1024*1024]; uint read,written,ignored;
        try {
            while(true) {
                if(!BackupRead(source,buffer,(uint)buffer.Length,out read,false,false,ref readContext)) throw WinError("O sistema de arquivos não permitiu copiar todos os fluxos");
                if(read==0) break;
                if(!BackupWrite(output,buffer,read,out written,false,false,ref writeContext) || written!=read) throw WinError("Não foi possível preservar todos os fluxos no destino");
            }
        } finally {
            BackupRead(source,new byte[0],0,out ignored,true,false,ref readContext);
            BackupWrite(output,new byte[0],0,out ignored,true,false,ref writeContext);
        }
    }
    public static TransferSnapshot Commit() {
        if(source==null || source.IsInvalid) throw new TransferFault("state", "Nenhuma movimentação foi preparada.");
        try {
            if(RenameLocked(destination)) { TransferSnapshot moved=Snapshot(Information(source),preparedHash); moved.method="rename"; return moved; }
            if(original.Links>1) throw new TransferFault("links", "Arquivo com vínculos adicionais: a transferência entre volumes exige revisão manual.");
            if((original.Attributes & 0x4000)!=0) throw new TransferFault("encrypted", "Arquivo criptografado: a cópia entre volumes foi recusada para preservar a proteção.");
            using(SafeFileHandle output=CreateFileW(Extended(destination),0x80000000|0x40000000|0x10000,0,IntPtr.Zero,1,0x08000000,IntPtr.Zero)) {
                if(output.IsInvalid) throw WinError("Destino ocupado ou sem permissão");
                bool verified=false;
                try {
                    CopyAllStreams(output);
                    if(!SetFileTime(output,ref original.Creation,IntPtr.Zero,ref original.Write) || !FlushFileBuffers(output)) throw WinError("Não foi possível salvar a cópia com segurança");
                    string hash=Hash(output); if(hash!=preparedHash) throw new TransferFault("integrity", "A cópia não corresponde à origem. A origem foi preservada.");
                    TransferSnapshot moved=Snapshot(Information(output),hash); moved.method="copy-verified";
                    verified=true; MarkDelete(source); return moved;
                } catch {
                    // Only our exclusive newly-created output can be discarded, and never a verified copy.
                    if(!verified) { try { MarkDelete(output); } catch {} }
                    throw;
                }
            }
        } finally { Abort(); }
    }
    public static TransferSnapshot Inspect(string file) {
        try {
            file=Path.GetFullPath(file); LockDirectories(Path.GetDirectoryName(file),false);
            uint attributes=GetFileAttributesW(Extended(file)); if(attributes==UInt32.MaxValue) throw WinError("Arquivo indisponível"); CheckAttributes(attributes);
            using(SafeFileHandle handle=CreateFileW(Extended(file),0x80000000,0,IntPtr.Zero,3,0x00200000|0x08000000,IntPtr.Zero)) {
                if(handle.IsInvalid) throw WinError("Arquivo em uso ou indisponível"); Info info=Information(handle); CheckAttributes(info.Attributes); return Snapshot(info,Hash(handle));
            }
        } finally { Abort(); }
    }
    public static void Abort() {
        if(source!=null) { source.Dispose(); source=null; }
        for(int i=directories.Count-1;i>=0;i--) directories[i].Dispose(); directories.Clear(); destination=null; preparedHash=null;
    }
}
