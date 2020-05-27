# homebridge-unifi-led-control

This plugin makes it possible to toggle LEDs on UniFi devices via [Homebridge](https://github.com/homebridge/homebridge).

For devices that support it (such as the FlexHD), you can also control the brightness and color of the LEDs.

## Configuration

Use the settings UI in Homebridge Config UI X to configure your controller URL and account details, or manually add the following to the platforms section of your config file:

```js
{
  "platforms": [
    {
      "platform": "UniFiLedControl",
      "name": "UniFi",
      "url": "https://CONTROLLER_ADDRESS:8443",
      "username": "YOUR_USERNAME",
      "password": "YOUR_PASSWORD"
    }
  ]
}
```

Note that by default the controller runs on port 443 instead of 8443 for UDM devices.
