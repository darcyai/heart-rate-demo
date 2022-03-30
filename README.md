# Darcy Heart Rate Demo

This repository contains microservices and packaging code for starting up a healthcare demonstration on Darcy Cloud. The demo application will deploy two microservices that work together and share data. One microservice produces heartrate data and sends it outward on the Edge Compute Network (ECN) that is created between the two microservices. The other microservice hosts a web UI for viewing the heartrate data. The UI microservice receives the heartrate data because it is attached to the ECN shared with the data source microservice. This is a powerful edge computing concept demonstrated by two simple microservices working together.

## Requirements

Before running the script you must:
 * Have an [Darcy Cloud](http://cloud.darcy.ai) project deployment with at least one node
 
### Configuration of the sensor simulator microservice

Set the config for this microservice if you want to label the heart rate data. Edit the [demo-app.yml](./demo-app.yml) file in order to change the configuration. Replace "Anonymous Person" with any data label you like.

```
      config:
        # data will be mocked
        test_mode: true
        data_label: "Anonymous Person"
```

### Viewing the sensor readings

Once the demo is running, you can access the web UI locally by visiting `http://NODE_IP_ADDRESS:5005` where "NODE_IP_ADDRESS" is the IP address of your edge node. 
