using System.IO;
using System.Runtime.InteropServices;

namespace Organiza.Wpf;

public static class RecycleBin
{
    // A permanent-delete fallback is explicitly vetoed by PreDeleteItem.
    public static Task Send(string file)
    {
        var done = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var thread = new Thread(() => { try { Recycle(file); done.SetResult(); } catch (Exception error) { done.SetException(error); } }) { IsBackground = true };
        thread.SetApartmentState(ApartmentState.STA); thread.Start(); return done.Task;
    }
    private static void Recycle(string file)
    {
        if (!Path.IsPathFullyQualified(file) || !File.Exists(file) || (File.GetAttributes(file) & (FileAttributes.Directory | FileAttributes.ReparsePoint)) != 0) throw new IOException("O arquivo não está disponível para a Lixeira.");
        object? instance = null; IShellItem? item = null;
        try
        {
            var id = typeof(IShellItem).GUID;
            Marshal.ThrowExceptionForHR(SHCreateItemFromParsingName(file, 0, ref id, out item));
            instance = Activator.CreateInstance(Type.GetTypeFromCLSID(new Guid("3ad05575-8857-4850-9277-11b85bdb8e09"), true)!);
            var operation = (IFileOperation)instance!;
            // SILENT | NOCONFIRMATION | NOERRORUI | RECYCLEONDELETE | EARLYFAILURE
            Marshal.ThrowExceptionForHR(operation.SetOperationFlags(0x0004 | 0x0010 | 0x0400 | 0x00080000 | 0x00100000));
            var sink = new RecycleSink();
            Marshal.ThrowExceptionForHR(operation.DeleteItem(item, sink));
            var result = operation.PerformOperations();
            Marshal.ThrowExceptionForHR(operation.GetAnyOperationsAborted(out var aborted));
            if (result < 0 || aborted || !sink.RecycleAllowed || !sink.Completed || File.Exists(file)) throw new IOException("O Windows não confirmou a reciclagem. Nenhuma exclusão permanente foi autorizada.");
        }
        finally { if (item is not null) Marshal.FinalReleaseComObject(item); if (instance is not null) Marshal.FinalReleaseComObject(instance); }
    }
    [DllImport("shell32.dll", CharSet = CharSet.Unicode, PreserveSig = true)] private static extern int SHCreateItemFromParsingName(string path, nint context, ref Guid iid, [MarshalAs(UnmanagedType.Interface)] out IShellItem item);
    [ComImport, Guid("43826d1e-e718-42ee-bc55-a1e261c37bfe"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] public interface IShellItem { }
    [ComImport, Guid("947aab5f-0a5c-4c13-b4d6-4bf7836fc9f8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] private interface IFileOperation
    {
        [PreserveSig] int Advise(IProgressSink sink, out uint cookie);
        [PreserveSig] int Unadvise(uint cookie);
        [PreserveSig] int SetOperationFlags(uint flags);
        [PreserveSig] int SetProgressMessage([MarshalAs(UnmanagedType.LPWStr)] string message);
        [PreserveSig] int SetProgressDialog(nint dialog);
        [PreserveSig] int SetProperties(nint properties);
        [PreserveSig] int SetOwnerWindow(nint owner);
        [PreserveSig] int ApplyPropertiesToItem(IShellItem item);
        [PreserveSig] int ApplyPropertiesToItems(nint items);
        [PreserveSig] int RenameItem(IShellItem item, [MarshalAs(UnmanagedType.LPWStr)] string name, IProgressSink sink);
        [PreserveSig] int RenameItems(nint items, [MarshalAs(UnmanagedType.LPWStr)] string name);
        [PreserveSig] int MoveItem(IShellItem item, IShellItem destination, [MarshalAs(UnmanagedType.LPWStr)] string name, IProgressSink sink);
        [PreserveSig] int MoveItems(nint items, IShellItem destination);
        [PreserveSig] int CopyItem(IShellItem item, IShellItem destination, [MarshalAs(UnmanagedType.LPWStr)] string name, IProgressSink sink);
        [PreserveSig] int CopyItems(nint items, IShellItem destination);
        [PreserveSig] int DeleteItem(IShellItem item, IProgressSink sink);
        [PreserveSig] int DeleteItems(nint items);
        [PreserveSig] int NewItem(IShellItem destination, uint attributes, [MarshalAs(UnmanagedType.LPWStr)] string name, [MarshalAs(UnmanagedType.LPWStr)] string template, IProgressSink sink);
        [PreserveSig] int PerformOperations();
        [PreserveSig] int GetAnyOperationsAborted([MarshalAs(UnmanagedType.Bool)] out bool aborted);
    }
    [ComVisible(true), Guid("04b0f1a7-9490-44bc-96e1-4296a31252e2"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] public interface IProgressSink
    {
        [PreserveSig] int StartOperations(); [PreserveSig] int FinishOperations(int result);
        [PreserveSig] int PreRenameItem(uint flags, IShellItem item, [MarshalAs(UnmanagedType.LPWStr)] string name);
        [PreserveSig] int PostRenameItem(uint flags, IShellItem item, [MarshalAs(UnmanagedType.LPWStr)] string name, int result, IShellItem? next);
        [PreserveSig] int PreMoveItem(uint flags, IShellItem item, IShellItem destination, [MarshalAs(UnmanagedType.LPWStr)] string name);
        [PreserveSig] int PostMoveItem(uint flags, IShellItem item, IShellItem destination, [MarshalAs(UnmanagedType.LPWStr)] string name, int result, IShellItem? next);
        [PreserveSig] int PreCopyItem(uint flags, IShellItem item, IShellItem destination, [MarshalAs(UnmanagedType.LPWStr)] string name);
        [PreserveSig] int PostCopyItem(uint flags, IShellItem item, IShellItem destination, [MarshalAs(UnmanagedType.LPWStr)] string name, int result, IShellItem? next);
        [PreserveSig] int PreDeleteItem(uint flags, IShellItem item);
        [PreserveSig] int PostDeleteItem(uint flags, IShellItem item, int result, IShellItem? next);
        [PreserveSig] int PreNewItem(uint flags, IShellItem destination, [MarshalAs(UnmanagedType.LPWStr)] string name);
        [PreserveSig] int PostNewItem(uint flags, IShellItem destination, [MarshalAs(UnmanagedType.LPWStr)] string name, [MarshalAs(UnmanagedType.LPWStr)] string template, uint attributes, int result, IShellItem? next);
        [PreserveSig] int UpdateProgress(uint total, uint completed);
        [PreserveSig] int ResetTimer(); [PreserveSig] int PauseTimer(); [PreserveSig] int ResumeTimer();
    }
    [ComVisible(true), ClassInterface(ClassInterfaceType.None)] public sealed class RecycleSink : IProgressSink
    {
        public bool RecycleAllowed { get; private set; } public bool Completed { get; private set; }
        private const int Abort = unchecked((int)0x80004004);
        public int PreDeleteItem(uint flags, IShellItem item) { RecycleAllowed = (flags & 0x80) != 0; return RecycleAllowed ? 0 : Abort; }
        public int PostDeleteItem(uint flags, IShellItem item, int result, IShellItem? next) { Completed = RecycleAllowed && result >= 0; return 0; }
        public int StartOperations() => 0; public int FinishOperations(int result) => 0;
        public int PreRenameItem(uint f, IShellItem i, string n) => Abort; public int PostRenameItem(uint f, IShellItem i, string n, int r, IShellItem? x) => 0;
        public int PreMoveItem(uint f, IShellItem i, IShellItem d, string n) => Abort; public int PostMoveItem(uint f, IShellItem i, IShellItem d, string n, int r, IShellItem? x) => 0;
        public int PreCopyItem(uint f, IShellItem i, IShellItem d, string n) => Abort; public int PostCopyItem(uint f, IShellItem i, IShellItem d, string n, int r, IShellItem? x) => 0;
        public int PreNewItem(uint f, IShellItem d, string n) => Abort; public int PostNewItem(uint f, IShellItem d, string n, string t, uint a, int r, IShellItem? x) => 0;
        public int UpdateProgress(uint t, uint c) => 0; public int ResetTimer() => 0; public int PauseTimer() => 0; public int ResumeTimer() => 0;
    }
}
