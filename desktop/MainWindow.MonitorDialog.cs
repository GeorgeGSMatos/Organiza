using Organiza.Wpf.Services;
using Organiza.Wpf.Presentation;

namespace Organiza.Wpf;

public partial class MainWindow
{
    private async Task MonitorDialog(string folderId)
    {
        OperationStatus.ShowProgress(Organiza.Wpf.Presentation.ProgressDisplay.From(new EngineProgress(ProgressKind.Discovering)));
        await Client.ActivateMonitoring([folderId]);
        _noticeIcon = AppIcon.Play;
        _noticeTone = StatusTone.Automatic;
        _notice = "Organização automática ativada. Este modo será mantido ao reabrir o Organiza.";
    }
}
