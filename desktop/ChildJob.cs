using System.Diagnostics;
using System.Runtime.InteropServices;
using Microsoft.Win32.SafeHandles;

namespace Organiza.Wpf;

// Prevent unattended monitoring if the UI crashes. Normal close always waits for the current file.
internal sealed class ChildJob : IDisposable
{
    private readonly SafeFileHandle _handle;
    public ChildJob()
    {
        _handle = CreateJobObject(0, null);
        var limits = new ExtendedLimits(); limits.Basic.LimitFlags = 0x2000;
        if (_handle.IsInvalid || !SetInformationJobObject(_handle, 9, ref limits, (uint)Marshal.SizeOf<ExtendedLimits>())) throw new InvalidOperationException("Não foi possível proteger a sessão do organizador.");
    }
    public void Attach(Process process) { if (!AssignProcessToJobObject(_handle, process.Handle)) throw new InvalidOperationException("Não foi possível vincular o motor à janela."); }
    public void Dispose() => _handle.Dispose();
    [StructLayout(LayoutKind.Sequential)] private struct BasicLimits { public long ProcessTime, JobTime; public uint LimitFlags; public nuint MinWorkingSet, MaxWorkingSet; public uint ActiveProcesses; public nuint Affinity; public uint Priority, Scheduling; }
    [StructLayout(LayoutKind.Sequential)] private struct IoCounters { public ulong ReadOps, WriteOps, OtherOps, ReadBytes, WriteBytes, OtherBytes; }
    [StructLayout(LayoutKind.Sequential)] private struct ExtendedLimits { public BasicLimits Basic; public IoCounters Io; public nuint ProcessMemory, JobMemory, PeakProcessMemory, PeakJobMemory; }
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode)] private static extern SafeFileHandle CreateJobObject(nint security, string? name);
    [DllImport("kernel32.dll")] private static extern bool SetInformationJobObject(SafeFileHandle job, int infoClass, ref ExtendedLimits info, uint length);
    [DllImport("kernel32.dll")] private static extern bool AssignProcessToJobObject(SafeFileHandle job, nint process);
}
