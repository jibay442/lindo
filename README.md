# Lindo

![Lindo in game screenshot](./screenshots/lindo-ingame.png)


**⚠️ Dofus Touch is the entire property of Ankama Games, and we are not affiliated with Ankama. None of the files hosted in this repository are under copyright: They come from Open Source projects, libraries, the original DofusTouch No-Emu created by Daniel & Thomas and the work of direct contributors. We do not intend to cause any harm to Ankama Games and will never take any revenue from this project.**

**Keep in mind that Lindo doesn't officially respect the TOU (also known as CGU, Conditions Générales d'Utilisation in french) of Dofus Touch, use it at your own risk.**

## Supported Platform
Lindo No-Emu works on :
- **Windows** 10 and newer (ia32/amd64/arm64)
- **macOS** 10.9 and newer
- **Linux** (Debian >= 9, Ubuntu >= 18) (amd64)

## Table of contents
<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->

- [Installation](#installation)
- [Issues](#issues)
  - [Run the arm64 mac os version for M1/M2 processors](#run-the-arm64-mac-os-version-for-m1m2-processors)
- [Windows Subsystem for Android (WSA) Mode](#windows-subsystem-for-android-wsa-mode)
  - [Requirements](#requirements)
  - [Setup](#setup)
  - [Usage](#usage)
- [Development](#development)
  - [Install the project](#install-the-project)
  - [Debug](#debug)
  - [Build the project](#build-the-project)
  - [Directory structure](#directory-structure)
  - [`dependencies` vs `devDependencies`](#dependencies-vs-devdependencies)
    - [How to help ?](#how-to-help-)
    - [Generate the Table of Content](#generate-the-table-of-content)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

# Installation
Download the latest version of Lindo No-Emu from [Github](https://github.com/prixe/lindo/releases/latest) for your platform.

- Windows
  - `Lindo.${version}.exe` : Portable executable version 
  - `Lindo.Setup.${version}.exe` : Installer version
  - `Lindo.${version}-win.zip` : Portable zip version
- MacOS
  - `Lindo-${version}.dmg` : Version for intel mac
  - `Lindo-${version}-arm64.dmg` : Version for arm mac (M1/M2) (see [Run the arm64 mac os version for M1/M2 processors](#run-the-arm64-mac-os-version-for-m1m2-processors))
- Linux
  - `Lindo-${version}.AppImage` : AppImage version
  - `lindo-${version}.tar.gz` : Portable tar.gz version
  - `lindo_${version}_amd64.deb` : Debian version

# Issues
## Run the arm64 mac os version for M1/M2 processors
![Issue with arm64 build](./screenshots/arm64-issue.png)
- Drop the **Lindo.app** into your `/Applications` folder
- Then open the `Terminal` application and run the following command:
```bash
$ xattr -d com.apple.quarantine /Applications/Lindo.app
```

# Windows Subsystem for Android (WSA) Mode

Lindo now supports running Dofus Touch through Windows Subsystem for Android (WSA), allowing you to play the official Android version of the game on Windows 11.

## Requirements

- Windows 11 (Build 22000 or later)
- Windows Subsystem for Android installed from Microsoft Store
- Android Debug Bridge (ADB) installed and available in PATH
- Virtualization enabled in BIOS/UEFI

## Setup

1. Install Windows Subsystem for Android from the Microsoft Store
2. Open WSA settings and enable Developer Mode
3. Install Android Debug Bridge (ADB) from Android SDK Platform Tools
4. Add ADB to your system's PATH environment variable
5. Launch Lindo and switch to WSA mode

## Usage

1. Launch Lindo
2. Click the Android icon in the top-right corner to switch to WSA mode
3. The application will check if your system meets all requirements
4. If all requirements are met, click "Launch Dofus Touch" to start the game
5. The game will launch in a new window using WSA

Note: WSA mode is only available on Windows 11. Make sure you have properly set up Windows Subsystem for Android and enabled Developer Mode in WSA settings.

# Development

## Install the project
```sh
$ git clone https://github.com/prixe/lindo.git
$ cd lindo
# install dependencies
$ yarn install
```
## Debug

Start the application in debug mode
```sh
# start the application
$ yarn dev
# or from the vs code, launch -> Debug App
```

## Build the project

Build the production artefact for your current platform
```sh
$ yarn build
```

## Directory structure

Once `dev` or `build` npm-script is executed, the `dist` folder will be generated. It has the same structure as the `packages` folder, the purpose of this design is to ensure the correct path calculation.

```tree
├── build                     Resources for the production build
|   ├── icon.icns             Icon for the application on macOS
|   ├── icon.ico              Icon for the application
|   ├── installerIcon.ico     Icon for the application installer
|   └── uninstallerIcon.ico   Icon for the application uninstaller
|
├── dist                      Generated after build according to the "packages" directory
|   ├── main                  Source for the main process of electron
|   ├── preload               Source for the preload process of electron
|   ├── renderer              Source for the webview (React Application)
|   └── shared                Shared files between the main and renderer process
|
├── release                   Generated after production build, contains executables
|   └──{version}
|       ├── win-unpacked      Contains unpacked application executable
|       └── Setup.exe         Installer for the application
|
├── scripts
|   ├── build.mjs             Develop script -> npm run build
|   └── watch.mjs             Develop script -> npm run dev
|
├── packages
|   ├── i18n                  Localization source code
|   ├── main                  Main-process source code
|   |   └── vite.config.ts
|   ├── preload               Preload-script source code
|   |   └── vite.config.ts
|   ├── renderer              Renderer-process source code
|   |   └── vite.config.ts
|   └── shared                Shared files between the main,renderer and preload process
```

## `dependencies` vs `devDependencies`

- First, you need to know if your dependencies are needed after the application is packaged.

- Like [electron-store](https://www.npmjs.com/package/electron-store), [fs-extra](https://www.npmjs.com/package/fs-extra) they are node-native modules and should be placed in `dependencies`. In addition, Vite will not build them, but treat them as external modules.

- Dependencies like [MUI](https://mui.com) and [React](https://www.npmjs.com/package/react), which are pure javascript modules that can be built with Vite, can be placed in `devDependencies`. This reduces the size of the application.

### How to help ?
You can contact a senior developer of the project as [Clover](https://github.com/Clover-Lindo) or [Zenoxs](https://github.com/zenoxs).
Then you can create a pull request to add or fix features, you can also submit improvement idea or bug issue in the [issues section](https://github.com/prixe/lindo/issues).

### Generate the Table of Content
If you edit the README.MD you wanna update the table of contents you can easily achieve it by using this command :
```sh
$ npx doctoc README.md
```
