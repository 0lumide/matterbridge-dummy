const MATTER_PORT = 6000;
const NAME = 'Platform';
const HOMEDIR = path.join('jest', NAME);

import path from 'node:path';

import { jest } from '@jest/globals';
import { wait } from 'matterbridge/utils';
import { LogLevel } from 'matterbridge/logger';
import {
  addBridgedEndpointSpy,
  addMatterbridgePlatform,
  createMatterbridgeEnvironment,
  destroyMatterbridgeEnvironment,
  log,
  loggerLogSpy,
  matterbridge,
  setupTest,
  startMatterbridgeEnvironment,
  stopMatterbridgeEnvironment,
} from 'matterbridge/jestutils';

import initializePlugin, { DummyPlatform, DummyPlatformConfig } from '../src/module.js';

// Setup the test environment
await setupTest(NAME, false);

describe('TestPlatform', () => {
  let platform: DummyPlatform;

  const config: DummyPlatformConfig = {
    name: 'matterbridge-dummy',
    type: 'DynamicPlatform',
    version: '0.0.1',
    devices: {
      outlet1: {
        deviceType: 'Outlet',
        autoOffDelayMs: 100,
      },
    },
    debug: true,
    unregisterOnShutdown: false,
  };

  beforeAll(async () => {
    // Create Matterbridge environment
    await createMatterbridgeEnvironment(NAME);
    await startMatterbridgeEnvironment(MATTER_PORT);
  });

  beforeEach(() => {
    // Reset the mock calls before each test
    jest.clearAllMocks();
  });

  afterEach(async () => {});

  afterAll(async () => {
    await platform.onShutdown();
    // Destroy Matterbridge environment
    await stopMatterbridgeEnvironment();
    await destroyMatterbridgeEnvironment();

    // Restore all mocks
    jest.restoreAllMocks();
  });

  it('should return an instance of Platform', async () => {
    platform = initializePlugin(matterbridge, log, config);
    expect(platform).toBeInstanceOf(DummyPlatform);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, 'Initializing platform:', config.name);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, 'Finished initializing platform:', config.name);
    await platform.onShutdown();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, 'onShutdown called with reason:', 'none');
  });

  it('should throw error in load when version is not valid', () => {
    matterbridge.matterbridgeVersion = '1.5.0';
    expect(() => new DummyPlatform(matterbridge, log, config)).toThrow(
      'This plugin requires Matterbridge version >= "3.4.0". Please update Matterbridge to the latest version in the frontend.',
    );
    matterbridge.matterbridgeVersion = '3.4.0';
  });

  it('should initialize platform with config name', () => {
    platform = new DummyPlatform(matterbridge, log, config);
    // Add the platform to the Matterbridge environment
    addMatterbridgePlatform(platform);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, 'Initializing platform:', config.name);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, 'Finished initializing platform:', config.name);
  });

  it('should call onStart with reason', async () => {
    await platform.onStart('Test reason');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, 'onStart called with reason:', 'Test reason');
    expect(addBridgedEndpointSpy).toHaveBeenCalledTimes(Object.keys(config.devices).length);
  });

  it('should call onConfigure', async () => {
    await platform.onConfigure();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, 'onConfigure called');
  });

  it('should execute command handler', async () => {
    platform.bridgedDevices.forEach(async (device) => {
      await device.executeCommandHandler('on');
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Device ${device.deviceName} on handler triggered.`);
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.NOTICE, `Device ${device.deviceName} turned on.`);
    });
    await wait(1000);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.NOTICE, expect.stringContaining(`turned off.`));
  });
});
