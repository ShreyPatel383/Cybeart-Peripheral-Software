[Setup]
AppName=Nighthawk 75 Driver
AppVersion=1.0
DefaultDirName={autopf}\Nighthawk75
DefaultGroupName=Nighthawk 75
OutputBaseFilename=Nighthawk75-Setup
Compression=lzma
SolidCompression=yes
PrivilegesRequired=admin
SetupIconFile=appico.ico

[Files]
Source: "target\release\nighthawk75-gui.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "target\release\nighthawk75.exe";     DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\Nighthawk 75";       Filename: "{app}\nighthawk75-gui.exe"
Name: "{commondesktop}\Nighthawk 75"; Filename: "{app}\nighthawk75-gui.exe"

[Run]
Filename: "{app}\nighthawk75-gui.exe"; Description: "Launch Nighthawk 75"; Flags: nowait postinstall skipifsilent