; Next-Videos Inno Setup Script
#define MyAppName "Next-Videos"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "LyariNet"
#define MyAppURL "https://github.com/lyarinet/Next-Videos"
#define MyAppExeName "Next-Videos.exe"

[Setup]
AppId={{D37F897B-6490-410E-921A-18F7C6B38641}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
AllowNoIcons=yes
OutputDir=..\dist-installer
OutputBaseFilename=Next-Videos-Setup-v1.0.0
SetupIconFile=..\image\logo.ico
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
DisableWelcomePage=no
PrivilegesRequired=lowest

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
Source: "..\{#MyAppExeName}"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\Setup-Next-Videos.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\image\*"; DestDir: "{app}\image"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\extension\*"; DestDir: "{app}\extension"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\backend\*"; DestDir: "{app}\backend"; Flags: ignoreversion recursesubdirs createallsubdirs; Excludes: "node_modules\*,downloads\*,tmp_uploads\*"
Source: "..\app\*"; DestDir: "{app}\app"; Flags: ignoreversion recursesubdirs createallsubdirs; Excludes: "node_modules\*,dist\*"
Source: "..\package.json"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\image\logo.ico"
Name: "{group}\Setup & Update Dependencies"; Filename: "{app}\Setup-Next-Videos.exe"; IconFilename: "{app}\image\logo.ico"
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\image\logo.ico"; Tasks: desktopicon

[Run]
Filename: "{app}\Setup-Next-Videos.exe"; Description: "Run Initial Setup (FFmpeg, yt-dlp & Extension)"; Flags: postinstall skipifsilent
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent unchecked
