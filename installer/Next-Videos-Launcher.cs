using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows.Forms;

namespace NextVideos
{
    public class LauncherForm : Form
    {
        [DllImport("user32.dll")]
        public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

        [STAThread]
        public static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            string appDir = AppDomain.CurrentDomain.BaseDirectory;
            string serverScript = Path.Combine(appDir, "backend", "server.js");

            // Verify server script exists
            if (!File.Exists(serverScript))
            {
                MessageBox.Show("Could not find backend/server.js in " + appDir, "Next-Videos Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
                return;
            }

            // Check if server is already running on port 3005
            bool isRunning = false;
            try
            {
                HttpWebRequest req = (HttpWebRequest)WebRequest.Create("http://localhost:3005/api/health");
                req.Timeout = 1000;
                using (HttpWebResponse res = (HttpWebResponse)req.GetResponse())
                {
                    if (res.StatusCode == HttpStatusCode.OK) isRunning = true;
                }
            }
            catch { }

            // Start backend if not running
            if (!isRunning)
            {
                ProcessStartInfo nodePsi = new ProcessStartInfo
                {
                    FileName = "node.exe",
                    Arguments = "\"" + serverScript + "\"",
                    WorkingDirectory = appDir,
                    CreateNoWindow = true,
                    UseShellExecute = false,
                    WindowStyle = ProcessWindowStyle.Hidden
                };

                try
                {
                    Process.Start(nodePsi);
                    Thread.Sleep(1500); // Give server a moment to bind port
                }
                catch (Exception ex)
                {
                    MessageBox.Show("Failed to start Node.js server: " + ex.Message + "\nPlease ensure Node.js is installed.", "Next-Videos Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
                    return;
                }
            }

            // Find Google Chrome path
            string chromePath = null;
            string[] possiblePaths = new string[]
            {
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "Google", "Chrome", "Application", "chrome.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "Google", "Chrome", "Application", "chrome.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Google", "Chrome", "Application", "chrome.exe")
            };

            foreach (string p in possiblePaths)
            {
                if (File.Exists(p))
                {
                    chromePath = p;
                    break;
                }
            }

            // Launch App
            if (!string.IsNullOrEmpty(chromePath))
            {
                Process.Start(chromePath, "--app=http://localhost:3005 --app-id=next-videos");
            }
            else
            {
                Process.Start("http://localhost:3005");
            }
        }
    }
}
