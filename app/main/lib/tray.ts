import path from 'path'
import moment from 'moment'
import {app, Menu, Tray} from 'electron'
import openAboutWindow from 'about-window'
import {Settings} from '../../types/settings'
import {IpcChannel} from '../../types/ipc'
import {sendIpc} from './ipc'
import {getSettings, setSettings} from './store'
import {createSettingsWindow} from './windows'
import {
  getBreakTime, checkInWorkingHours, checkIdle, startBreakNow, createBreak,
} from './breaks'

let tray: Tray = null
let lastMinsLeft = 0

export function buildTray(): void {
  if (!tray) {
    let imgPath
    if (process.platform === 'darwin') {
      imgPath = process.env.NODE_ENV === 'development' ?
        'resources/tray/tray-IconTemplate.png' :
        path.join(process.resourcesPath, 'app/resources/tray/tray-IconTemplate.png')
    } else {
      imgPath = process.env.NODE_ENV === 'development' ?
        'resources/tray/icon.png' :
        path.join(process.resourcesPath, 'app/resources/tray/icon.png')
    }
    tray = new Tray(imgPath)
  }

  let settings: Settings = getSettings()
  const breaksEnabled = settings.breaksEnabled

  const setBreaksEnabled = (breaksEnabled: boolean): void => {
    settings = getSettings()
    setSettings({...settings, breaksEnabled})
    sendIpc(IpcChannel.GET_SETTINGS_SUCCESS, settings)
    buildTray()
  }

  const createAboutWindow = (): void => {
    openAboutWindow({
      icon_path: process.env.NODE_ENV === 'development' ?
        path.join(__dirname, '../../../resources/icon.png') :
        path.join(process.resourcesPath, 'app/resources/icon.png'),
      package_json_dir: path.join(__dirname, '../../..'),
      win_options: {
        icon: process.env.NODE_ENV === 'development' ?
          path.join(__dirname, '../../../resources/tray/icon.png') :
          path.join(process.resourcesPath, 'app/resources/tray/icon.png'),
        autoHideMenuBar: true,
      }
    })
  }

  const quit = (): void => {
    setTimeout(() => {
      app.exit(0)
    })
  }

  const breakTime = getBreakTime()
  const inWorkingHours = checkInWorkingHours()
  const idle = checkIdle()
  const minsLeft = breakTime && breakTime.diff(moment(), 'minutes')

  let nextBreak: string

  if (minsLeft > 1) {
    nextBreak = `Next break in ${minsLeft} minutes`
  } else if (minsLeft === 1) {
    nextBreak = `Next break in 1 minute`
  } else {
    nextBreak = `Next break in less than a minute`
  }

  const contextMenu = Menu.buildFromTemplate([
    {
      label: nextBreak,
      visible: breakTime !== null && inWorkingHours,
      enabled: false
    },
    {
      label: `Outside of working hours`,
      visible: !inWorkingHours,
      enabled: false
    },
    {
      label: `Idle`,
      visible: idle,
      enabled: false
    },
    {type: 'separator'},
    {
      label: breaksEnabled ? 'Disable' : 'Enable',
      click: setBreaksEnabled.bind(null, !breaksEnabled)
    },
    {
      label: 'Start break now',
      visible: breakTime !== null && inWorkingHours,
      click: startBreakNow
    },
    {
      label: 'Restart break period',
      visible: breakTime !== null && inWorkingHours,
      click: createBreak.bind(null, false)
    },
    {type: 'separator'},
    {label: 'Settings', click: createSettingsWindow},
    {label: 'About', click: createAboutWindow},
    {label: 'Quit', click: quit}
  ])

  // Call this again for Linux because we modified the context menu
  tray.setContextMenu(contextMenu)

  // On windows, context menu will not show on left click by default
  if (process.platform === 'win32') {
    tray.on('click', () => {
      tray.popUpContextMenu()
    })
  }
}

export function initTray() {
  buildTray()
  setInterval(() => {
    const breakTime = getBreakTime()
    if (breakTime === null) {
      return
    }

    const minsLeft = breakTime.diff(moment(), 'minutes')
    if (minsLeft !== lastMinsLeft) {
      buildTray()
      lastMinsLeft = minsLeft
    }
  }, 5000)
}
