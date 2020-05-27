const { homebridge, Accessory, UUIDGen } = require('./types');
const UniFiAPI = require('./UniFiAPI');
const UniFiDevice = require('./UniFiDevice');

const PLUGIN_NAME = 'homebridge-unifi-led-control';
const PLATFORM_NAME = 'UniFiLedControl';

const DEFAULT_REFRESH_INTERVAL = 60000;

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = class UniFiLedControl {
  constructor(log, config, api) {
    this.log = log;
    this.config = config;
    this.api = api;
    this.client = this.getClient();

    this.accessories = [];

    this.api.on('didFinishLaunching', this.didFinishLaunching.bind(this));
  }

  static register() {
    homebridge.registerPlatform(PLUGIN_NAME, PLATFORM_NAME, UniFiLedControl);
  }

  getClient() {
    return new UniFiAPI({
      url: this.config.url,
      username: this.config.username,
      password: this.config.password,
    }, this.log);
  }

  async didFinishLaunching() {
    await this.client.login();

    this.runLoop();
  }

  async runLoop() {
    const interval = this.config.refreshInterval || DEFAULT_REFRESH_INTERVAL;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        await this.refreshDevices();
      } catch (e) { }

      await delay(interval);
    }
  }

  async refreshDevices() {
    this.log.debug('Refreshing devices...');

    try {
      let sites = await this.client.getSites();

      for (let site of sites.data) {
        let devices = await this.client.getDevices(site.name);

        await this.loadDevices(site, devices.data);
      }
    } catch (e) {
      this.log.error(`Error getting devices: ${e}`);
      throw e;
    }
  }

  async loadDevices(site, devices) {
    let foundAccessories = [];

    for (let device of devices) {
      let accessory = await this.loadDevice(site, device);
      if (accessory) {
        foundAccessories.push(accessory);
      }
    }

    let removedAccessories = this.accessories.filter(a => !foundAccessories.includes(a));
    if (removedAccessories.length > 0) {
      this.log.info(`Removing ${removedAccessories.length} device(s)`);
      let removedHomeKitAccessories = removedAccessories.map(a => a.homeKitAccessory);
      this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, removedHomeKitAccessories);
    }

    this.accessories = foundAccessories;
  }

  async loadDevice(site, device) {
    let accessory = this.accessories.find(a => a.matches(device));
    if (!accessory) {
      this.log.info(`Setting up new device: ${device.model} (MAC: ${device.mac})`);
      let homeKitAccessory = this.createHomeKitAccessory(site, device);
      accessory = new UniFiDevice(this, homeKitAccessory);
      this.accessories.push(accessory);
    }

    await accessory.update(site, device);

    return accessory;
  }

  createHomeKitAccessory(site, device) {
    let uuid = UUIDGen.generate(device.mac);
    let homeKitAccessory = new Accessory(device.name || device.model || device.mac, uuid);
    homeKitAccessory.context = UniFiDevice.getContextForDevice(site, device);
    this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [homeKitAccessory]);
    return homeKitAccessory;
  }

  // Homebridge calls this method on boot to reinitialize previously-discovered devices
  configureAccessory(homeKitAccessory) {
    // Make sure we haven't set up this accessory already
    let accessory = this.accessories.find(a => a.homeKitAccessory === homeKitAccessory);
    if (accessory) {
      return;
    }

    accessory = new UniFiDevice(this, homeKitAccessory);
    this.accessories.push(accessory);
  }
};
