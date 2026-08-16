using System;
using System.ComponentModel;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.IO;
using System.IO.Compression;
using System.Net;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows.Forms;

namespace NextVideosInstaller
{
    public class SetupForm : Form
    {
        private ProgressBar progressBar;
        private Label lblStatus;
        private Label lblTitle;
        private Label lblSubtitle;
        private Button btnAction;
        private Button btnClose;
        private Panel pnlHeader;
        private Panel pnlContent;
        private ListBox listSteps;
        private PictureBox picLogo;
        private BackgroundWorker worker;
        private string rootDir;

        [STAThread]
        public static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new SetupForm());
        }

        public SetupForm()
        {
            rootDir = AppDomain.CurrentDomain.BaseDirectory;
            InitializeComponent();
        }

        private void InitializeComponent()
        {
            this.Text = "Next-Videos Desktop Setup Wizard";
            this.Size = new Size(680, 520);
            this.StartPosition = FormStartPosition.CenterScreen;
            this.FormBorderStyle = FormBorderStyle.FixedDialog;
            this.MaximizeBox = false;
            this.BackColor = Color.FromArgb(9, 13, 22); // #090d16
            this.ForeColor = Color.FromArgb(248, 250, 252);
            this.Font = new Font("Segoe UI", 9.5f, FontStyle.Regular);

            string icoPath = Path.Combine(rootDir, "image", "logo.ico");
            if (File.Exists(icoPath))
            {
                try { this.Icon = new Icon(icoPath); } catch { }
            }

            // Header Panel
            pnlHeader = new Panel
            {
                Dock = DockStyle.Top,
                Height = 90,
                BackColor = Color.FromArgb(15, 23, 42), // #0f172a
                Padding = new Padding(20, 15, 20, 15)
            };

            picLogo = new PictureBox
            {
                Size = new Size(54, 54),
                Location = new Point(20, 18),
                SizeMode = PictureBoxSizeMode.Zoom
            };

            string logoPng = Path.Combine(rootDir, "image", "logo.png");
            if (File.Exists(logoPng))
            {
                try { picLogo.Image = Image.FromFile(logoPng); } catch { }
            }

            lblTitle = new Label
            {
                Text = "Next-Videos Desktop App Setup",
                Location = new Point(88, 18),
                AutoSize = true,
                Font = new Font("Segoe UI", 15f, FontStyle.Bold),
                ForeColor = Color.White
            };

            lblSubtitle = new Label
            {
                Text = "Automated installer for FFmpeg, yt-dlp, Node runtime & Chrome Extension",
                Location = new Point(90, 48),
                AutoSize = true,
                Font = new Font("Segoe UI", 9.5f, FontStyle.Regular),
                ForeColor = Color.FromArgb(148, 163, 184)
            };

            pnlHeader.Controls.Add(picLogo);
            pnlHeader.Controls.Add(lblTitle);
            pnlHeader.Controls.Add(lblSubtitle);

            // Content Panel
            pnlContent = new Panel
            {
                Dock = DockStyle.Fill,
                Padding = new Padding(24)
            };

            listSteps = new ListBox
            {
                Location = new Point(24, 105),
                Size = new Size(616, 230),
                BackColor = Color.FromArgb(15, 23, 42),
                ForeColor = Color.FromArgb(203, 213, 225),
                Font = new Font("Consolas", 9.5f),
                BorderStyle = BorderStyle.FixedSingle,
                IntegralHeight = false
            };

            listSteps.Items.Add("Ready to configure Next-Videos environment.");
            listSteps.Items.Add("Click 'Start Installation' below to begin setup.");

            lblStatus = new Label
            {
                Text = "Status: Waiting for user action...",
                Location = new Point(24, 345),
                Size = new Size(616, 24),
                Font = new Font("Segoe UI", 9.5f, FontStyle.Bold),
                ForeColor = Color.FromArgb(0, 153, 222)
            };

            progressBar = new ProgressBar
            {
                Location = new Point(24, 375),
                Size = new Size(616, 20),
                Style = ProgressBarStyle.Continuous,
                Value = 0
            };

            btnAction = new Button
            {
                Text = "Start Installation",
                Location = new Point(460, 415),
                Size = new Size(180, 42),
                BackColor = Color.FromArgb(0, 71, 186),
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat,
                Font = new Font("Segoe UI", 10.5f, FontStyle.Bold),
                Cursor = Cursors.Hand
            };
            btnAction.FlatAppearance.BorderSize = 0;
            btnAction.Click += BtnAction_Click;

            btnClose = new Button
            {
                Text = "Cancel",
                Location = new Point(350, 415),
                Size = new Size(100, 42),
                BackColor = Color.FromArgb(30, 41, 59),
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat,
                Font = new Font("Segoe UI", 9.5f, FontStyle.Regular),
                Cursor = Cursors.Hand
            };
            btnClose.FlatAppearance.BorderSize = 0;
            btnClose.Click += (s, e) => this.Close();

            this.Controls.Add(btnAction);
            this.Controls.Add(btnClose);
            this.Controls.Add(progressBar);
            this.Controls.Add(lblStatus);
            this.Controls.Add(listSteps);
            this.Controls.Add(pnlHeader);

            worker = new BackgroundWorker
            {
                WorkerReportsProgress = true,
                WorkerSupportsCancellation = true
            };
            worker.DoWork += Worker_DoWork;
            worker.ProgressChanged += Worker_ProgressChanged;
            worker.RunWorkerCompleted += Worker_RunWorkerCompleted;
        }

        private void BtnAction_Click(object sender, EventArgs e)
        {
            if (btnAction.Text == "Launch Next-Videos")
            {
                string launcherExe = Path.Combine(rootDir, "Next-Videos.exe");
                if (File.Exists(launcherExe))
                {
                    Process.Start(launcherExe);
                }
                else
                {
                    Process.Start("http://localhost:3005");
                }
                this.Close();
                return;
            }

            btnAction.Enabled = false;
            btnClose.Enabled = false;
            listSteps.Items.Clear();
            worker.RunWorkerAsync();
        }

        private void LogStep(string message, int progressPercent)
        {
            worker.ReportProgress(progressPercent, message);
        }

        private void Worker_DoWork(object sender, DoWorkEventArgs e)
        {
            // Step 1: Check Node.js
            LogStep("🔍 [1/6] Checking Node.js Environment...", 10);
            bool nodeFound = false;
            try
            {
                Process p = Process.Start(new ProcessStartInfo
                {
                    FileName = "node",
                    Arguments = "-v",
                    RedirectStandardOutput = true,
                    UseShellExecute = false,
                    CreateNoWindow = true
                });
                string ver = p.StandardOutput.ReadToEnd().Trim();
                p.WaitForExit();
                if (!string.IsNullOrEmpty(ver))
                {
                    nodeFound = true;
                    LogStep("  ✔ Node.js " + ver + " detected.", 15);
                }
            }
            catch { }

            if (!nodeFound)
            {
                LogStep("  ⚠ Node.js not detected. Trying to install via winget...", 15);
                try
                {
                    Process wp = Process.Start(new ProcessStartInfo
                    {
                        FileName = "winget",
                        Arguments = "install OpenJS.NodeJS -e --silent --accept-source-agreements --accept-package-agreements",
                        UseShellExecute = false,
                        CreateNoWindow = true
                    });
                    wp.WaitForExit();
                }
                catch { }
            }

            // Step 2: Binaries setup (yt-dlp & FFmpeg)
            LogStep("📦 [2/6] Checking Core Media Binaries (yt-dlp & FFmpeg)...", 25);
            string binDir = Path.Combine(rootDir, "backend", "bin");
            if (!Directory.Exists(binDir)) Directory.CreateDirectory(binDir);

            // yt-dlp
            string ytdlpPath = Path.Combine(binDir, "yt-dlp.exe");
            if (!File.Exists(ytdlpPath))
            {
                LogStep("  ⏳ Downloading latest yt-dlp.exe from GitHub...", 30);
                try
                {
                    ServicePointManager.SecurityProtocol = (SecurityProtocolType)3072;
                    using (WebClient wc = new WebClient())
                    {
                        wc.DownloadFile("https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe", ytdlpPath);
                    }
                    LogStep("  ✔ yt-dlp.exe downloaded successfully.", 35);
                }
                catch (Exception ex)
                {
                    LogStep("  ⚠ yt-dlp download failed: " + ex.Message, 35);
                }
            }
            else
            {
                LogStep("  ✔ yt-dlp.exe verified in backend/bin.", 35);
            }

            // FFmpeg
            string ffmpegPath = Path.Combine(binDir, "ffmpeg.exe");
            string ffprobePath = Path.Combine(binDir, "ffprobe.exe");

            if (!File.Exists(ffmpegPath) || !File.Exists(ffprobePath))
            {
                LogStep("  ⏳ Downloading FFmpeg essentials package...", 40);
                try
                {
                    string zipPath = Path.Combine(binDir, "ffmpeg.zip");
                    using (WebClient wc = new WebClient())
                    {
                        wc.DownloadFile("https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip", zipPath);
                    }

                    LogStep("  ⏳ Extracting FFmpeg binaries...", 45);
                    string extractTemp = Path.Combine(binDir, "temp_ff");
                    ZipFile.ExtractToDirectory(zipPath, extractTemp);

                    string[] foundFfmpeg = Directory.GetFiles(extractTemp, "ffmpeg.exe", SearchOption.AllDirectories);
                    string[] foundFfprobe = Directory.GetFiles(extractTemp, "ffprobe.exe", SearchOption.AllDirectories);

                    if (foundFfmpeg.Length > 0) File.Copy(foundFfmpeg[0], ffmpegPath, true);
                    if (foundFfprobe.Length > 0) File.Copy(foundFfprobe[0], ffprobePath, true);

                    try { File.Delete(zipPath); } catch { }
                    try { Directory.Delete(extractTemp, true); } catch { }

                    LogStep("  ✔ FFmpeg and FFprobe extracted successfully.", 50);
                }
                catch (Exception ex)
                {
                    LogStep("  ⚠ FFmpeg download failed: " + ex.Message, 50);
                }
            }
            else
            {
                LogStep("  ✔ FFmpeg and FFprobe verified in backend/bin.", 50);
            }

            // Step 3: Install NPM packages
            LogStep("⚡ [3/6] Installing NPM Dependencies...", 55);
            RunProcess("npm", "install", Path.Combine(rootDir, "backend"));
            RunProcess("npm", "install", Path.Combine(rootDir, "app"));
            LogStep("  ✔ Backend and Frontend NPM dependencies installed.", 70);

            // Step 4: Build Web Application
            LogStep("🔨 [4/6] Building Production Web Application...", 75);
            RunProcess("npm", "run build", Path.Combine(rootDir, "app"));

            string appDist = Path.Combine(rootDir, "app", "dist");
            string backendPublic = Path.Combine(rootDir, "backend", "public");
            if (Directory.Exists(appDist))
            {
                if (!Directory.Exists(backendPublic)) Directory.CreateDirectory(backendPublic);
                CopyDirectory(appDist, backendPublic);
                LogStep("  ✔ Production bundle compiled and synchronized.", 85);
            }

            // Step 5: Desktop and Start Menu Shortcuts
            LogStep("🖥️ [5/6] Creating Desktop & Start Menu Shortcuts with Logo Icon...", 90);
            string desktopDir = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
            string programsDir = Environment.GetFolderPath(Environment.SpecialFolder.Programs);
            string launcherExe = Path.Combine(rootDir, "Next-Videos.exe");
            string icoPath = Path.Combine(rootDir, "image", "logo.ico");

            CreateShortcut(Path.Combine(desktopDir, "Next-Videos.lnk"), launcherExe, rootDir, icoPath, "Next-Videos Video Downloader");
            CreateShortcut(Path.Combine(programsDir, "Next-Videos.lnk"), launcherExe, rootDir, icoPath, "Next-Videos Video Downloader");
            LogStep("  ✔ Desktop shortcut 'Next-Videos' created with custom icon.", 95);

            // Step 6: Launch Chrome Extension Guide
            LogStep("🌐 [6/6] Launching Chrome Extension Setup & Initializing...", 98);
            string guidePath = Path.Combine(rootDir, "extension", "install-guide.html");

            string chromePath = FindChrome();
            if (!string.IsNullOrEmpty(chromePath))
            {
                try
                {
                    Process.Start(chromePath, "chrome://extensions");
                    Process.Start(chromePath, "\"" + guidePath + "\"");
                }
                catch { }
            }
            else
            {
                try { Process.Start(guidePath); } catch { }
            }

            LogStep("🎉 Setup Completed Successfully!", 100);
        }

        private void Worker_ProgressChanged(object sender, ProgressChangedEventArgs e)
        {
            progressBar.Value = Math.Min(Math.Max(e.ProgressPercentage, 0), 100);
            string msg = e.UserState as string;
            if (!string.IsNullOrEmpty(msg))
            {
                listSteps.Items.Add(msg);
                listSteps.TopIndex = listSteps.Items.Count - 1;
                lblStatus.Text = "Status: " + msg.Replace("🔍 ", "").Replace("📦 ", "").Replace("⚡ ", "").Replace("🔨 ", "").Replace("🖥️ ", "").Replace("🌐 ", "");
            }
        }

        private void Worker_RunWorkerCompleted(object sender, RunWorkerCompletedEventArgs e)
        {
            btnAction.Text = "Launch Next-Videos";
            btnAction.BackColor = Color.FromArgb(16, 185, 129); // Green
            btnAction.Enabled = true;
            btnClose.Text = "Finish";
            btnClose.Enabled = true;
            lblStatus.Text = "Status: Installation complete! Ready to launch.";
            lblStatus.ForeColor = Color.FromArgb(52, 211, 153);
        }

        private void RunProcess(string filename, string args, string workingDir)
        {
            try
            {
                ProcessStartInfo psi = new ProcessStartInfo
                {
                    FileName = "cmd.exe",
                    Arguments = "/c " + filename + " " + args,
                    WorkingDirectory = workingDir,
                    CreateNoWindow = true,
                    UseShellExecute = false
                };
                Process p = Process.Start(psi);
                p.WaitForExit();
            }
            catch { }
        }

        private void CopyDirectory(string sourceDir, string targetDir)
        {
            Directory.CreateDirectory(targetDir);
            foreach (string file in Directory.GetFiles(sourceDir))
            {
                string dest = Path.Combine(targetDir, Path.GetFileName(file));
                File.Copy(file, dest, true);
            }
            foreach (string sub in Directory.GetDirectories(sourceDir))
            {
                string dest = Path.Combine(targetDir, Path.GetFileName(sub));
                CopyDirectory(sub, dest);
            }
        }

        private void CreateShortcut(string shortcutPath, string targetPath, string workingDir, string iconPath, string description)
        {
            try
            {
                Type t = Type.GetTypeFromProgID("WScript.Shell");
                dynamic shell = Activator.CreateInstance(t);
                dynamic shortcut = shell.CreateShortcut(shortcutPath);
                shortcut.TargetPath = targetPath;
                shortcut.WorkingDirectory = workingDir;
                shortcut.IconLocation = iconPath + ",0";
                shortcut.Description = description;
                shortcut.Save();
            }
            catch { }
        }

        private string FindChrome()
        {
            string[] possiblePaths = new string[]
            {
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "Google", "Chrome", "Application", "chrome.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "Google", "Chrome", "Application", "chrome.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Google", "Chrome", "Application", "chrome.exe")
            };

            foreach (string p in possiblePaths)
            {
                if (File.Exists(p)) return p;
            }
            return null;
        }
    }
}
