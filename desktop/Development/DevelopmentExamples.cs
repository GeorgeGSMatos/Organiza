#if DEBUG
using System.IO;
using Organiza.Wpf.Services;

namespace Organiza.Wpf.Development;

public static class DevelopmentExamples
{
    public static async Task Seed(OrganizaClient client, DevelopmentOptions options)
    {
        if (!options.Demo || (await client.GetState()).Items("folders").Any()) return;
        var root = Path.Combine(options.SourceRoot, ".dev", "examples");
        foreach (var name in new[] { "Downloads", "My Drive", "Documentos" })
        {
            var path = Path.Combine(root, name); Directory.CreateDirectory(path);
            var state = await client.SaveFolder(new FolderDraft(path, name, false));
            var id = state.Items("folders").First(folder => folder.S("name") == name).S("id");
            await client.AddPresetRules(id);
        }
        foreach (var name in new[] { "Relatório.pdf", "Comprovante.pdf", "Projeto.psd", "Foto.png", "Notas.txt" })
        {
            var path = Path.Combine(root, "Downloads", name);
            if (File.Exists(path)) continue;
            await File.WriteAllTextAsync(path, "Arquivo de exemplo do Organiza — desenvolvimento.");
            File.SetLastWriteTimeUtc(path, DateTime.UtcNow.AddMinutes(-10));
        }
    }
}
#endif
