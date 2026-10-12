$ErrorActionPreference = "Stop"

$projectRoot = "C:\Users\demok\Desktop\NotesApp-main"
$scratchDir  = "C:\Users\demok\.gemini\antigravity\brain\464b9a67-5a15-493d-9fed-c5ab576271fa\scratch"
$releaseDir  = Join-Path $projectRoot "release"
$portableDir = Join-Path $releaseDir "NotesApp-Portable"
$buildTmpDir = Join-Path $scratchDir "installer-build"

New-Item -ItemType Directory -Force -Path $scratchDir  | Out-Null
New-Item -ItemType Directory -Force -Path $releaseDir  | Out-Null
if (Test-Path $buildTmpDir) { Remove-Item $buildTmpDir -Recurse -Force }
New-Item -ItemType Directory -Force -Path $buildTmpDir | Out-Null

# ---------------------------------------------------------------------------
# 1. Define data directories (staged as clean empty directories in $portableDir)
# ---------------------------------------------------------------------------
$dataDirs = @(
  "01-inbox",
  "02-source-notes",
  "03-atomic-notes",
  "04-content-maps",
  "05-self-assessment",
  "06-spaced-repetition"
)

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

# ---------------------------------------------------------------------------
# 2. Generate notesapp.ico from notesapp-clean.png
# ---------------------------------------------------------------------------
Add-Type -AssemblyName System.Drawing
$pngPath = Join-Path $projectRoot "notesapp-clean.png"
$icoPath = Join-Path $buildTmpDir "notesapp.ico"

$srcBmp = New-Object System.Drawing.Bitmap($pngPath)
$resizedBmp = New-Object System.Drawing.Bitmap($srcBmp, 256, 256)
$msPng = New-Object System.IO.MemoryStream
$resizedBmp.Save($msPng, [System.Drawing.Imaging.ImageFormat]::Png)
$pngBytes = $msPng.ToArray()
$msPng.Close()
$resizedBmp.Dispose()
$srcBmp.Dispose()

$fsIco = [System.IO.File]::OpenWrite($icoPath)
$bw = New-Object System.IO.BinaryWriter($fsIco)
# ICONDIR header
$bw.Write([UInt16]0)   # reserved
$bw.Write([UInt16]1)   # type: 1 = icon
$bw.Write([UInt16]1)   # count: 1 image
# ICONDIRENTRY
$bw.Write([Byte]0)     # width 0 = 256
$bw.Write([Byte]0)     # height 0 = 256
$bw.Write([Byte]0)     # color count
$bw.Write([Byte]0)     # reserved
$bw.Write([UInt16]1)   # color planes
$bw.Write([UInt16]32)  # bits per pixel
$bw.Write([UInt32]$pngBytes.Length)
$bw.Write([UInt32]22)  # offset (6 + 16)
$bw.Write($pngBytes)
$bw.Flush()
$bw.Close()
$fsIco.Close()

Copy-Item $icoPath (Join-Path $projectRoot "public\favicon.ico") -Force
Write-Host "Generated icon: $icoPath"

# ---------------------------------------------------------------------------
# 3. Compile NotesApp.exe (Desktop App Launcher + System Tray Manager)
# ---------------------------------------------------------------------------
$csc = "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"

$launcherCs = @'
using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net;
using System.Reflection;
using System.Threading;
using System.Windows.Forms;

[assembly: AssemblyTitle("NotesApp")]
[assembly: AssemblyDescription("NotesApp - Sistema de Toma de Notas y Repaso Espaciado")]
[assembly: AssemblyCompany("NotesApp")]
[assembly: AssemblyProduct("NotesApp")]
[assembly: AssemblyVersion("1.0.0.0")]
[assembly: AssemblyFileVersion("1.0.0.0")]

namespace NotesAppLauncher
{
    static class Program
    {
        private static Process serverProcess = null;
        private static NotifyIcon trayIcon = null;
        private static string appUrl = "http://localhost:3456";
        private static string appDir = "";
        private static string dataDir = "";

        [STAThread]
        static void Main(string[] args)
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            appDir = Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location);
            dataDir = ResolveDataDirectory(appDir);

            // If server is already listening on 3456, just open the window and exit
            if (IsServerListening())
            {
                OpenAppWindow();
                return;
            }

            if (!StartBackendServer())
            {
                return;
            }

            // Wait up to 8 seconds for server readiness
            for (int i = 0; i < 50; i++)
            {
                if (IsServerListening()) break;
                Thread.Sleep(150);
            }

            SetupSystemTray();
            OpenAppWindow();

            Application.ApplicationExit += OnApplicationExit;
            Application.Run();
        }

        private static string ResolveDataDirectory(string baseDir)
        {
            try
            {
                string testFile = Path.Combine(baseDir, "06-spaced-repetition", ".write_test");
                Directory.CreateDirectory(Path.Combine(baseDir, "06-spaced-repetition"));
                File.WriteAllText(testFile, "ok");
                File.Delete(testFile);
                return baseDir;
            }
            catch
            {
                string fallback = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                    "NotesApp",
                    "Data"
                );
                Directory.CreateDirectory(fallback);
                return fallback;
            }
        }

        private static bool IsServerListening()
        {
            try
            {
                HttpWebRequest req = (HttpWebRequest)WebRequest.Create("http://127.0.0.1:3456/api/stats");
                req.Timeout = 400;
                req.Method = "GET";
                using (HttpWebResponse res = (HttpWebResponse)req.GetResponse())
                {
                    return res.StatusCode == HttpStatusCode.OK;
                }
            }
            catch
            {
                return false;
            }
        }

        private static bool StartBackendServer()
        {
            string bundledNode = Path.Combine(appDir, "runtime", "node.exe");
            string nodeExe = File.Exists(bundledNode) ? bundledNode : "node.exe";
            string serverJs = Path.Combine(appDir, "server.js");

            if (!File.Exists(serverJs))
            {
                MessageBox.Show(
                    "No se encontró server.js en: " + serverJs,
                    "NotesApp - Error",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error
                );
                return false;
            }

            try
            {
                ProcessStartInfo psi = new ProcessStartInfo();
                psi.FileName = nodeExe;
                psi.Arguments = "\"" + serverJs + "\"";
                psi.WorkingDirectory = appDir;
                psi.CreateNoWindow = true;
                psi.UseShellExecute = false;
                psi.EnvironmentVariables["PORT"] = "3456";
                psi.EnvironmentVariables["NOTESAPP_DATA_DIR"] = dataDir;

                serverProcess = Process.Start(psi);
                return true;
            }
            catch (Exception ex)
            {
                MessageBox.Show(
                    "No se pudo iniciar el motor de NotesApp:\n" + ex.Message,
                    "NotesApp - Error de inicio",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error
                );
                return false;
            }
        }

        private static void OpenAppWindow()
        {
            try
            {
                string[] edgePaths = new string[] {
                    Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), @"Microsoft\Edge\Application\msedge.exe"),
                    Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), @"Microsoft\Edge\Application\msedge.exe"),
                    @"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
                    @"C:\Program Files\Microsoft\Edge\Application\msedge.exe"
                };

                foreach (string edge in edgePaths)
                {
                    if (File.Exists(edge))
                    {
                        Process.Start(edge, "--app=" + appUrl);
                        return;
                    }
                }

                string[] chromePaths = new string[] {
                    Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), @"Google\Chrome\Application\chrome.exe"),
                    Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), @"Google\Chrome\Application\chrome.exe")
                };

                foreach (string chrome in chromePaths)
                {
                    if (File.Exists(chrome))
                    {
                        Process.Start(chrome, "--app=" + appUrl);
                        return;
                    }
                }

                Process.Start(appUrl);
            }
            catch
            {
                try { Process.Start(appUrl); } catch { }
            }
        }

        private static void SetupSystemTray()
        {
            ContextMenu menu = new ContextMenu();

            MenuItem openItem = new MenuItem("Abrir NotesApp");
            openItem.DefaultItem = true;
            openItem.Click += delegate { OpenAppWindow(); };

            MenuItem folderItem = new MenuItem("Abrir carpeta de notas (Markdown)");
            folderItem.Click += delegate {
                try { Process.Start("explorer.exe", "\"" + dataDir + "\""); } catch { }
            };

            MenuItem exitItem = new MenuItem("Cerrar NotesApp");
            exitItem.Click += delegate {
                StopBackendServer();
                if (trayIcon != null) trayIcon.Visible = false;
                Application.Exit();
            };

            menu.MenuItems.Add(openItem);
            menu.MenuItems.Add(folderItem);
            menu.MenuItems.Add("-");
            menu.MenuItems.Add(exitItem);

            trayIcon = new NotifyIcon();
            trayIcon.Text = "NotesApp (Activo en puerto 3456)";
            try
            {
                trayIcon.Icon = Icon.ExtractAssociatedIcon(Assembly.GetExecutingAssembly().Location);
            }
            catch
            {
                trayIcon.Icon = SystemIcons.Application;
            }
            trayIcon.ContextMenu = menu;
            trayIcon.Visible = true;
            trayIcon.DoubleClick += delegate { OpenAppWindow(); };
        }

        private static void StopBackendServer()
        {
            try
            {
                if (serverProcess != null && !serverProcess.HasExited)
                {
                    serverProcess.Kill();
                    serverProcess.WaitForExit(2000);
                }
            }
            catch { }
        }

        private static void OnApplicationExit(object sender, EventArgs e)
        {
            StopBackendServer();
            if (trayIcon != null)
            {
                trayIcon.Visible = false;
                trayIcon.Dispose();
            }
        }
    }
}
'@

$launcherCsPath = Join-Path $buildTmpDir "Launcher.cs"
$launcherExePath = Join-Path $buildTmpDir "NotesApp.exe"
[System.IO.File]::WriteAllText($launcherCsPath, $launcherCs, [System.Text.Encoding]::UTF8)

& $csc /nologo /target:winexe /out:$launcherExePath /win32icon:$icoPath /r:System.dll /r:System.Drawing.dll /r:System.Windows.Forms.dll $launcherCsPath
if ($LASTEXITCODE -ne 0) { throw "Failed to compile NotesApp.exe" }
Write-Host "Compiled NotesApp.exe"

# ---------------------------------------------------------------------------
# 4. Compile Uninstall-NotesApp.exe
# ---------------------------------------------------------------------------
$uninstallCs = @'
using System;
using System.Diagnostics;
using System.IO;
using System.Reflection;
using System.Windows.Forms;
using Microsoft.Win32;

[assembly: AssemblyTitle("Uninstall NotesApp")]
[assembly: AssemblyProduct("NotesApp")]
[assembly: AssemblyVersion("1.0.0.0")]

namespace NotesAppUninstaller
{
    static class Program
    {
        [STAThread]
        static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            DialogResult confirm = MessageBox.Show(
                "¿Deseas desinstalar NotesApp de tu equipo?",
                "Desinstalar NotesApp",
                MessageBoxButtons.YesNo,
                MessageBoxIcon.Question
            );
            if (confirm != DialogResult.Yes) return;

            string appDir = Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location);

            // Stop running NotesApp processes
            try
            {
                foreach (Process p in Process.GetProcessesByName("NotesApp"))
                {
                    if (p.Id != Process.GetCurrentProcess().Id)
                    {
                        try { p.Kill(); p.WaitForExit(2000); } catch { }
                    }
                }
            }
            catch { }

            // Remove shortcuts
            try
            {
                string desktopLnk = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory), "NotesApp.lnk");
                if (File.Exists(desktopLnk)) File.Delete(desktopLnk);

                string startMenuLnk = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Programs), "NotesApp.lnk");
                if (File.Exists(startMenuLnk)) File.Delete(startMenuLnk);
            }
            catch { }

            // Remove Registry key
            try
            {
                Registry.CurrentUser.DeleteSubKeyTree(@"Software\Microsoft\Windows\CurrentVersion\Uninstall\NotesApp", false);
            }
            catch { }

            MessageBox.Show(
                "NotesApp se ha desinstalado correctamente.",
                "Desinstalación completada",
                MessageBoxButtons.OK,
                MessageBoxIcon.Information
            );

            // Schedule self-deletion of installation directory
            try
            {
                ProcessStartInfo psi = new ProcessStartInfo();
                psi.FileName = "cmd.exe";
                psi.Arguments = "/c timeout /t 2 /nobreak >nul & rmdir /s /q \"" + appDir + "\"";
                psi.CreateNoWindow = true;
                psi.UseShellExecute = false;
                psi.WorkingDirectory = Path.GetTempPath();
                Process.Start(psi);
            }
            catch { }
        }
    }
}
'@

$uninstallCsPath = Join-Path $buildTmpDir "Uninstall.cs"
$uninstallExePath = Join-Path $buildTmpDir "Uninstall-NotesApp.exe"
[System.IO.File]::WriteAllText($uninstallCsPath, $uninstallCs, [System.Text.Encoding]::UTF8)

& $csc /nologo /target:winexe /out:$uninstallExePath /win32icon:$icoPath /r:System.dll /r:System.Drawing.dll /r:System.Windows.Forms.dll $uninstallCsPath
if ($LASTEXITCODE -ne 0) { throw "Failed to compile Uninstall-NotesApp.exe" }
Write-Host "Compiled Uninstall-NotesApp.exe"

# ---------------------------------------------------------------------------
# 5. Stage Clean Portable Package in release\NotesApp-Portable
# ---------------------------------------------------------------------------
Write-Host "Staging clean application files into $portableDir ..."
if (Test-Path $portableDir) { Remove-Item $portableDir -Recurse -Force }
New-Item -ItemType Directory -Force -Path $portableDir | Out-Null

# Copy core app files
Copy-Item $launcherExePath (Join-Path $portableDir "NotesApp.exe") -Force
Copy-Item $uninstallExePath (Join-Path $portableDir "Uninstall-NotesApp.exe") -Force
Copy-Item $icoPath (Join-Path $portableDir "notesapp.ico") -Force
Copy-Item (Join-Path $projectRoot "server.js") (Join-Path $portableDir "server.js") -Force
Copy-Item (Join-Path $projectRoot "package.json") (Join-Path $portableDir "package.json") -Force
Copy-Item (Join-Path $projectRoot "README.md") (Join-Path $portableDir "README.md") -Force
Copy-Item (Join-Path $projectRoot "GUIA-INICIACION.md") (Join-Path $portableDir "GUIA-INICIACION.md") -Force
Copy-Item (Join-Path $projectRoot "iniciar-notesapp.bat") (Join-Path $portableDir "iniciar-notesapp.bat") -Force

# Copy public, _templates, and node_modules
Copy-Item (Join-Path $projectRoot "public") (Join-Path $portableDir "public") -Recurse -Force
Copy-Item (Join-Path $projectRoot "_templates") (Join-Path $portableDir "_templates") -Recurse -Force
Copy-Item (Join-Path $projectRoot "node_modules") (Join-Path $portableDir "node_modules") -Recurse -Force

# Copy empty clean 01..06 directories
foreach ($d in $dataDirs) {
  $targetD = Join-Path $portableDir $d
  New-Item -ItemType Directory -Force -Path $targetD | Out-Null
  Set-Content -Path (Join-Path $targetD ".gitkeep") -Value "" -NoNewline -Encoding UTF8
}
[System.IO.File]::WriteAllText((Join-Path $portableDir "06-spaced-repetition\proyectos.json"), "{`n  `"campos`": {}`n}`n", $utf8NoBom)
[System.IO.File]::WriteAllText((Join-Path $portableDir "06-spaced-repetition\carpetas.json"), "{`n  `"atomica`": {},`n  `"fuente`": {},`n  `"mapa`": {},`n  `"bandeja`": {}`n}`n", $utf8NoBom)

# Bundle Node.js runtime so target Windows PCs don't even need Node installed
$runtimeDir = Join-Path $portableDir "runtime"
New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null
$nodeCmd = Get-Command node -ErrorAction Stop
Copy-Item $nodeCmd.Source (Join-Path $runtimeDir "node.exe") -Force
Write-Host "Bundled Node.js runtime from $($nodeCmd.Source)"

# Also copy NotesApp.exe into projectRoot so the user has the direct launcher in their project folder too
Copy-Item $launcherExePath (Join-Path $projectRoot "NotesApp.exe") -Force

# ---------------------------------------------------------------------------
# 6. Create payload.zip for the Single-File Setup Installer
# ---------------------------------------------------------------------------
Add-Type -AssemblyName System.IO.Compression.FileSystem
$payloadZip = Join-Path $buildTmpDir "payload.zip"
if (Test-Path $payloadZip) { Remove-Item $payloadZip -Force }
Write-Host "Compressing application payload into $payloadZip ..."
[System.IO.Compression.ZipFile]::CreateFromDirectory($portableDir, $payloadZip, [System.IO.Compression.CompressionLevel]::Optimal, $false)
$zipSizeMB = [Math]::Round((Get-Item $payloadZip).Length / 1MB, 2)
Write-Host "Payload size: $zipSizeMB MB"

# ---------------------------------------------------------------------------
# 7. Compile NotesApp-Setup-1.0.0.exe (Windows GUI Setup Wizard with embedded payload.zip)
# ---------------------------------------------------------------------------
$setupCs = @'
using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Threading;
using System.Windows.Forms;
using Microsoft.Win32;

[assembly: AssemblyTitle("NotesApp Setup")]
[assembly: AssemblyDescription("Instalador oficial de NotesApp para Windows")]
[assembly: AssemblyCompany("NotesApp")]
[assembly: AssemblyProduct("NotesApp")]
[assembly: AssemblyVersion("1.0.0.0")]
[assembly: AssemblyFileVersion("1.0.0.0")]

namespace NotesAppSetup
{
    public class SetupForm : Form
    {
        private TextBox txtPath;
        private Button btnBrowse;
        private CheckBox chkDesktop;
        private CheckBox chkStartMenu;
        private CheckBox chkLaunch;
        private ProgressBar progressBar;
        private Label lblStatus;
        private Button btnInstall;
        private Button btnCancel;

        public SetupForm()
        {
            this.Text = "Instalador de NotesApp v1.0.0";
            this.ClientSize = new Size(540, 395);
            this.FormBorderStyle = FormBorderStyle.FixedDialog;
            this.MaximizeBox = false;
            this.StartPosition = FormStartPosition.CenterScreen;
            this.BackColor = Color.FromArgb(18, 22, 31);
            this.ForeColor = Color.FromArgb(241, 245, 249);
            this.Font = new Font("Segoe UI", 9.5f, FontStyle.Regular);

            try
            {
                this.Icon = Icon.ExtractAssociatedIcon(Assembly.GetExecutingAssembly().Location);
            }
            catch { }

            Panel headerPanel = new Panel();
            headerPanel.BackColor = Color.FromArgb(26, 32, 44);
            headerPanel.SetBounds(0, 0, 540, 86);

            Label lblTitle = new Label();
            lblTitle.Text = "NotesApp v1.0.0";
            lblTitle.Font = new Font("Segoe UI", 16f, FontStyle.Bold);
            lblTitle.ForeColor = Color.FromArgb(248, 250, 252);
            lblTitle.SetBounds(24, 16, 480, 32);

            Label lblSub = new Label();
            lblSub.Text = "Sistema de Notas Atómicas (Zettelkasten) y Repaso Espaciado SM-2";
            lblSub.Font = new Font("Segoe UI", 9.5f, FontStyle.Regular);
            lblSub.ForeColor = Color.FromArgb(148, 163, 184);
            lblSub.SetBounds(26, 50, 490, 22);

            headerPanel.Controls.Add(lblTitle);
            headerPanel.Controls.Add(lblSub);
            this.Controls.Add(headerPanel);

            Label lblDir = new Label();
            lblDir.Text = "Carpeta de instalación:";
            lblDir.Font = new Font("Segoe UI", 9.5f, FontStyle.Bold);
            lblDir.ForeColor = Color.FromArgb(226, 232, 240);
            lblDir.SetBounds(24, 104, 300, 20);
            this.Controls.Add(lblDir);

            string defaultDir = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "Programs",
                "NotesApp"
            );

            txtPath = new TextBox();
            txtPath.Text = defaultDir;
            txtPath.BackColor = Color.FromArgb(30, 41, 59);
            txtPath.ForeColor = Color.White;
            txtPath.BorderStyle = BorderStyle.FixedSingle;
            txtPath.SetBounds(24, 130, 390, 28);
            this.Controls.Add(txtPath);

            btnBrowse = new Button();
            btnBrowse.Text = "Examinar...";
            btnBrowse.FlatStyle = FlatStyle.Flat;
            btnBrowse.BackColor = Color.FromArgb(51, 65, 85);
            btnBrowse.ForeColor = Color.White;
            btnBrowse.SetBounds(422, 128, 94, 29);
            btnBrowse.Click += OnBrowseClick;
            this.Controls.Add(btnBrowse);

            chkDesktop = new CheckBox();
            chkDesktop.Text = "Crear acceso directo en el Escritorio";
            chkDesktop.Checked = true;
            chkDesktop.ForeColor = Color.FromArgb(226, 232, 240);
            chkDesktop.SetBounds(26, 174, 460, 24);
            this.Controls.Add(chkDesktop);

            chkStartMenu = new CheckBox();
            chkStartMenu.Text = "Crear acceso directo en el Menú Inicio";
            chkStartMenu.Checked = true;
            chkStartMenu.ForeColor = Color.FromArgb(226, 232, 240);
            chkStartMenu.SetBounds(26, 204, 460, 24);
            this.Controls.Add(chkStartMenu);

            chkLaunch = new CheckBox();
            chkLaunch.Text = "Iniciar NotesApp al finalizar la instalación";
            chkLaunch.Checked = true;
            chkLaunch.ForeColor = Color.FromArgb(226, 232, 240);
            chkLaunch.SetBounds(26, 234, 460, 24);
            this.Controls.Add(chkLaunch);

            lblStatus = new Label();
            lblStatus.Text = "Listo para instalar (incluye entorno autónomo sin dependencias externas).";
            lblStatus.ForeColor = Color.FromArgb(148, 163, 184);
            lblStatus.SetBounds(24, 274, 492, 22);
            this.Controls.Add(lblStatus);

            progressBar = new ProgressBar();
            progressBar.Minimum = 0;
            progressBar.Maximum = 100;
            progressBar.Value = 0;
            progressBar.SetBounds(24, 300, 492, 22);
            this.Controls.Add(progressBar);

            btnInstall = new Button();
            btnInstall.Text = "Instalar ahora";
            btnInstall.Font = new Font("Segoe UI", 10f, FontStyle.Bold);
            btnInstall.FlatStyle = FlatStyle.Flat;
            btnInstall.BackColor = Color.FromArgb(59, 130, 246);
            btnInstall.ForeColor = Color.White;
            btnInstall.SetBounds(376, 338, 140, 36);
            btnInstall.Click += OnInstallClick;
            this.Controls.Add(btnInstall);

            btnCancel = new Button();
            btnCancel.Text = "Cancelar";
            btnCancel.FlatStyle = FlatStyle.Flat;
            btnCancel.BackColor = Color.FromArgb(51, 65, 85);
            btnCancel.ForeColor = Color.White;
            btnCancel.SetBounds(266, 338, 100, 36);
            btnCancel.Click += delegate { this.Close(); };
            this.Controls.Add(btnCancel);
        }

        private void OnBrowseClick(object sender, EventArgs e)
        {
            using (FolderBrowserDialog fbd = new FolderBrowserDialog())
            {
                fbd.Description = "Selecciona la carpeta donde deseas instalar NotesApp:";
                fbd.SelectedPath = txtPath.Text;
                if (fbd.ShowDialog() == DialogResult.OK)
                {
                    txtPath.Text = Path.Combine(fbd.SelectedPath, "NotesApp");
                }
            }
        }

        private void OnInstallClick(object sender, EventArgs e)
        {
            string targetDir = txtPath.Text.Trim();
            if (string.IsNullOrEmpty(targetDir))
            {
                MessageBox.Show("Por favor, selecciona una carpeta de instalación válida.", "Atención", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                return;
            }

            btnInstall.Enabled = false;
            btnCancel.Enabled = false;
            btnBrowse.Enabled = false;
            txtPath.ReadOnly = true;

            bool createDesktop = chkDesktop.Checked;
            bool createStart = chkStartMenu.Checked;
            bool launchAfter = chkLaunch.Checked;

            Thread worker = new Thread(delegate()
            {
                RunInstallation(targetDir, createDesktop, createStart, launchAfter, false);
            });
            worker.IsBackground = true;
            worker.Start();
        }

        public void RunInstallation(string targetDir, bool createDesktop, bool createStart, bool launchAfter, bool silent)
        {
            try
            {
                UpdateProgress(5, "Preparando directorio de instalación...", silent);
                Directory.CreateDirectory(targetDir);

                Stream resStream = Assembly.GetExecutingAssembly().GetManifestResourceStream("NotesAppSetup.payload.zip");
                if (resStream == null)
                {
                    throw new Exception("No se encontró el paquete comprimido dentro del instalador.");
                }

                using (ZipArchive archive = new ZipArchive(resStream, ZipArchiveMode.Read))
                {
                    int total = archive.Entries.Count;
                    int current = 0;

                    foreach (ZipArchiveEntry entry in archive.Entries)
                    {
                        current++;
                        string fullPath = Path.Combine(targetDir, entry.FullName.Replace('/', Path.DirectorySeparatorChar));

                        if (string.IsNullOrEmpty(entry.Name))
                        {
                            Directory.CreateDirectory(fullPath);
                            continue;
                        }

                        string parentDir = Path.GetDirectoryName(fullPath);
                        if (!string.IsNullOrEmpty(parentDir))
                        {
                            Directory.CreateDirectory(parentDir);
                        }

                        entry.ExtractToFile(fullPath, true);

                        if (current % 25 == 0 || current == total)
                        {
                            int pct = 5 + (int)((current / (double)total) * 80.0);
                            UpdateProgress(pct, "Instalando archivos (" + current + " de " + total + ")...", silent);
                        }
                    }
                }

                string exePath = Path.Combine(targetDir, "NotesApp.exe");
                string icoPath = Path.Combine(targetDir, "notesapp.ico");
                string uninstallPath = Path.Combine(targetDir, "Uninstall-NotesApp.exe");

                UpdateProgress(90, "Creando accesos directos...", silent);
                if (createDesktop)
                {
                    string desktopLnk = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory), "NotesApp.lnk");
                    CreateShortcut(desktopLnk, exePath, targetDir, icoPath, "NotesApp - Notas Atómicas y Repaso Espaciado");
                }
                if (createStart)
                {
                    string startMenuLnk = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Programs), "NotesApp.lnk");
                    CreateShortcut(startMenuLnk, exePath, targetDir, icoPath, "NotesApp - Notas Atómicas y Repaso Espaciado");
                }

                UpdateProgress(95, "Registrando aplicación en Windows...", silent);
                RegisterUninstaller(targetDir, icoPath, uninstallPath);

                UpdateProgress(100, "¡Instalación completada con éxito!", silent);

                if (!silent)
                {
                    this.Invoke((MethodInvoker)delegate
                    {
                        MessageBox.Show(
                            this,
                            "NotesApp se ha instalado correctamente en:\n" + targetDir,
                            "Instalación completada",
                            MessageBoxButtons.OK,
                            MessageBoxIcon.Information
                        );

                        if (launchAfter && File.Exists(exePath))
                        {
                            try { Process.Start(exePath); } catch { }
                        }
                        this.Close();
                    });
                }
                else if (launchAfter && File.Exists(exePath))
                {
                    try { Process.Start(exePath); } catch { }
                }
            }
            catch (Exception ex)
            {
                if (!silent)
                {
                    this.Invoke((MethodInvoker)delegate
                    {
                        MessageBox.Show(
                            this,
                            "Error durante la instalación:\n" + ex.Message,
                            "Error de instalación",
                            MessageBoxButtons.OK,
                            MessageBoxIcon.Error
                        );
                        btnInstall.Enabled = true;
                        btnCancel.Enabled = true;
                    });
                }
                else
                {
                    Console.Error.WriteLine(ex.ToString());
                    Environment.ExitCode = 1;
                }
            }
        }

        private void UpdateProgress(int percent, string message, bool silent)
        {
            if (silent) return;
            try
            {
                this.Invoke((MethodInvoker)delegate
                {
                    progressBar.Value = Math.Min(100, Math.Max(0, percent));
                    lblStatus.Text = message;
                });
            }
            catch { }
        }

        private static void CreateShortcut(string shortcutPath, string targetPath, string workDir, string iconPath, string description)
        {
            try
            {
                Type shellType = Type.GetTypeFromProgID("WScript.Shell");
                if (shellType == null) return;
                object shell = Activator.CreateInstance(shellType);
                object shortcut = shellType.InvokeMember("CreateShortcut", BindingFlags.InvokeMethod, null, shell, new object[] { shortcutPath });
                Type scType = shortcut.GetType();
                scType.InvokeMember("TargetPath", BindingFlags.SetProperty, null, shortcut, new object[] { targetPath });
                scType.InvokeMember("WorkingDirectory", BindingFlags.SetProperty, null, shortcut, new object[] { workDir });
                scType.InvokeMember("IconLocation", BindingFlags.SetProperty, null, shortcut, new object[] { iconPath });
                scType.InvokeMember("Description", BindingFlags.SetProperty, null, shortcut, new object[] { description });
                scType.InvokeMember("Save", BindingFlags.InvokeMethod, null, shortcut, null);
            }
            catch { }
        }

        private static void RegisterUninstaller(string installDir, string iconPath, string uninstallPath)
        {
            try
            {
                using (RegistryKey key = Registry.CurrentUser.CreateSubKey(@"Software\Microsoft\Windows\CurrentVersion\Uninstall\NotesApp"))
                {
                    if (key != null)
                    {
                        key.SetValue("DisplayName", "NotesApp");
                        key.SetValue("DisplayVersion", "1.0.0");
                        key.SetValue("Publisher", "NotesApp");
                        key.SetValue("DisplayIcon", iconPath);
                        key.SetValue("InstallLocation", installDir);
                        key.SetValue("UninstallString", "\"" + uninstallPath + "\"");
                        key.SetValue("NoModify", 1, RegistryValueKind.DWord);
                        key.SetValue("NoRepair", 1, RegistryValueKind.DWord);
                    }
                }
            }
            catch { }
        }
    }

    static class Program
    {
        [STAThread]
        static void Main(string[] args)
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            // Support silent install: NotesApp-Setup-1.0.0.exe /S [/D=C:\path]
            bool silent = false;
            string customDir = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "Programs",
                "NotesApp"
            );

            foreach (string a in args)
            {
                if (string.Equals(a, "/S", StringComparison.OrdinalIgnoreCase))
                {
                    silent = true;
                }
                else if (a.StartsWith("/D=", StringComparison.OrdinalIgnoreCase))
                {
                    customDir = a.Substring(3).Trim('"');
                }
            }

            if (silent)
            {
                SetupForm form = new SetupForm();
                form.RunInstallation(customDir, false, false, false, true);
                return;
            }

            Application.Run(new SetupForm());
        }
    }
}
'@

$setupCsPath = Join-Path $buildTmpDir "Setup.cs"
$setupExeReleasePath = Join-Path $releaseDir "NotesApp-Setup-1.0.0.exe"
$setupExeRootPath    = Join-Path $projectRoot "NotesApp-Setup-1.0.0.exe"
[System.IO.File]::WriteAllText($setupCsPath, $setupCs, [System.Text.Encoding]::UTF8)

& $csc /nologo /target:winexe /out:$setupExeReleasePath /win32icon:$icoPath "/resource:$payloadZip,NotesAppSetup.payload.zip" /r:System.dll /r:System.Drawing.dll /r:System.Windows.Forms.dll /r:System.IO.Compression.dll /r:System.IO.Compression.FileSystem.dll $setupCsPath
if ($LASTEXITCODE -ne 0) { throw "Failed to compile NotesApp-Setup-1.0.0.exe" }

Copy-Item $setupExeReleasePath $setupExeRootPath -Force
$installerSizeMB = [Math]::Round((Get-Item $setupExeReleasePath).Length / 1MB, 2)
Write-Host "========================================================="
Write-Host "SUCCESS! Built Windows Installer:"
Write-Host " -> $setupExeReleasePath ($installerSizeMB MB)"
Write-Host " -> $setupExeRootPath ($installerSizeMB MB)"
Write-Host " -> Portable App: $portableDir\NotesApp.exe"
Write-Host "========================================================="
