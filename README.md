# About

This is a [matterbridge](https://github.com/Luligu/matterbridge) plugin that lets you create dummy devices to help with automations. It is insprired by the homebridge dummy plugin, and based on the matterbridge-webhooks plugin.

This plugin provides the following types of virtual matter devices

- Switch
- Bulb
- Outlet

When turned on the device turns back off after the configured timeout, or indefinitely is so desired.

# Pre-requisite

This plugin requires [matterbridge](https://github.com/Luligu/matterbridge). See the installation section of the matterbridge documentation.

# Installation

## mpm

```
cd ~/Matterbridge
sudo npm install -g matterbridge-dummy --omit=dev
matterbridge -add matterbridge-dummy
```

## Local

- Clone the repo
  ```
  git clone https://github.com/0lumide/matterbridge-dummy.git
  ```
- Build the repo
  ```
  cd matterbridge-dummy && npm run npmPack
  ```
- Upload the built tgz package to the matterbridge ui.
- Once it's been uploaded, restart matterbridge.
- type `matterbridge-dummy` into the "plugin name" field of the "Install Plugins" section, then click add.
