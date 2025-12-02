/**
 * This file contains the class DummyPlatform.
 * This file is a modified version of the original module.ts from https://github.com/Luligu/matterbridge-webhooks.
 *
 * @file module.ts
 * @author Luca Liguori
 * @author Olumide Awofeso
 * @version 0.0.1
 * @license Apache-2.0
 *
 * Copyright 2025, 2026, 2027 Luca Liguori.
 * Copyright 2025 Olumide Awofeso.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { bridgedNode, MatterbridgeDynamicPlatform, MatterbridgeEndpoint, onOffLight, onOffOutlet, onOffSwitch, PlatformConfig, PlatformMatterbridge } from 'matterbridge';
import { AnsiLogger } from 'matterbridge/logger';

export interface DummyConfig {
  deviceType: 'Outlet' | 'Switch' | 'Light';
  autoOffDelayMs: number;
}

export type DummyPlatformConfig = PlatformConfig & {
  devices: Record<string, DummyConfig>;
};

/**
 * This is the standard interface for Matterbridge plugins.
 * Each plugin should export a default function that follows this signature.
 *
 * @param {PlatformMatterbridge} matterbridge - An instance of MatterBridge. This is the main interface for interacting with the MatterBridge system.
 * @param {AnsiLogger} log - An instance of AnsiLogger. This is used for logging messages in a format that can be displayed with ANSI color codes.
 * @param {PlatformConfig} config - The platform configuration.
 * @returns {Platform} - An instance of the SomfyTahomaPlatform. This is the main interface for interacting with the Somfy Tahoma system.
 */
export default function initializePlugin(matterbridge: PlatformMatterbridge, log: AnsiLogger, config: DummyPlatformConfig): DummyPlatform {
  return new DummyPlatform(matterbridge, log, config);
}

export class DummyPlatform extends MatterbridgeDynamicPlatform {
  private devices: Record<string, DummyConfig>;
  // Track timers to clear them on shutdown.
  private autoOffTimers: NodeJS.Timeout[] = [];
  readonly bridgedDevices = new Map<string, MatterbridgeEndpoint>();

  constructor(matterbridge: PlatformMatterbridge, log: AnsiLogger, config: DummyPlatformConfig) {
    super(matterbridge, log, config);

    // Verify that Matterbridge is the correct version
    if (this.verifyMatterbridgeVersion === undefined || typeof this.verifyMatterbridgeVersion !== 'function' || !this.verifyMatterbridgeVersion('3.4.0')) {
      throw new Error(`This plugin requires Matterbridge version >= "3.4.0". Please update Matterbridge to the latest version in the frontend.`);
    }

    this.log.info('Initializing platform:', this.config.name);

    this.devices = config.devices;

    this.log.info('Finished initializing platform:', this.config.name);
  }

  override async onStart(reason?: string): Promise<void> {
    this.log.info('onStart called with reason:', reason ?? 'none');

    // Clear all devices select
    await this.ready;
    await this.clearSelect();

    // Register devices
    let i = 0;
    for (const deviceName in this.devices) {
      this.log.debug(`Loading devices ${++i} ${deviceName}`);

      const device = this.devices[deviceName];
      this.setSelectDevice('device' + i, deviceName, undefined, 'hub');
      if (!this.validateDevice(['device' + i, deviceName], true)) continue;
      this.log.info(`Registering device: ${deviceName}`);
      const matterDevice = new MatterbridgeEndpoint(
        [device.deviceType === 'Outlet' ? onOffOutlet : device.deviceType === 'Light' ? onOffLight : onOffSwitch, bridgedNode],
        { id: deviceName },
        this.config.debug as boolean,
      )
        .createDefaultBridgedDeviceBasicInformationClusterServer(
          deviceName,
          'device' + i++,
          this.matterbridge.aggregatorVendorId,
          'Matterbridge',
          'Matterbridge dummy',
          0,
          this.config.version as string,
        )
        .createOnOffClusterServer(false)
        .addRequiredClusterServers()
        .addCommandHandler('on', async () => {
          this.log.info(`Device ${deviceName} on handler triggered.`);
          if (device.autoOffDelayMs == 0) {
            await matterDevice.setAttribute('onOff', 'onOff', false, matterDevice.log);
            this.log.notice(`Device ${deviceName} on ignored.`);
          } else {
            await matterDevice.setAttribute('onOff', 'onOff', true, matterDevice.log);
            this.log.notice(`Device ${deviceName} turned on.`);
          }
          if (device.autoOffDelayMs > 0) {
            const timer = setTimeout(async () => {
              await matterDevice.setAttribute('onOff', 'onOff', false, matterDevice.log);
              this.log.notice(`Device ${deviceName} turned off.`);
            }, device.autoOffDelayMs);
            this.autoOffTimers.push(timer);
          }
        })
        .addCommandHandler('off', async () => {
          this.log.info(`Device ${deviceName} off handler triggered.`);
          await matterDevice.setAttribute('onOff', 'onOff', false, matterDevice.log);
        });
      await this.registerDevice(matterDevice);
      this.bridgedDevices.set(deviceName, matterDevice);
    }
  }

  override async onConfigure(): Promise<void> {
    await super.onConfigure();
    this.log.info('onConfigure called');
    this.bridgedDevices.forEach(async (device) => {
      this.log.info(`Configuring device: ${device.deviceName}`);
      await device.setAttribute('onOff', 'onOff', false, device.log);
    });
  }

  override async onShutdown(reason?: string): Promise<void> {
    await super.onShutdown(reason);
    this.log.info('onShutdown called with reason:', reason ?? 'none');
    this.autoOffTimers.forEach((timer) => clearTimeout(timer));
    this.autoOffTimers = [];
    if (this.config.unregisterOnShutdown === true) await this.unregisterAllDevices();
    this.bridgedDevices.clear();
  }
}
