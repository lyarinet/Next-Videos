Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
ScriptDir = fso.GetParentFolderName(WScript.ScriptFullName)

' Run start-desktop.bat hidden
WshShell.Run """" & ScriptDir & "\start-desktop.bat""", 0, False
