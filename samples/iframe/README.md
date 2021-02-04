# Embedding an STP enabled page in an iFrame

Besides using the SDK to enable sketch and speech symbol creation on an editor, it is also possible to embed an existing app in an iFrame. 

To allow access to the microphone is situations in which the domain serving the hosting page is different than the embedded iframe's, a `allow="microphone"` property is required to signal to browsers that access is allowed:  

```html
<iframe src="https://server.com/stpapp"  allow="microphone" scrolling="no" width="100%" height="800"></iframe>
 ```

**NOTE:** The speech services require secure access via `HTTPS`, otherwise most browsers will either block access or request authorization to access the microphone repeatedly, which is not a viable user experience. Make sure that the pages are properly configured to use valid certificates.

## Troubleshooting microphone access

If a message indicating an error recognizing speech is displayed once a stroke is placed on the map, even if `allow="microphone"` is properly set on the iframe, verify the following:

1. A microphone needs to be connected and operational, otherwise there is a failure at the moment audio stream initialization is attempted
1. If the page embedding the `iframe` is accessed via `HTTP` (not SSL enabled), while the page pointed to (`src` parameter) is SSL enabled, the connection to the speech services may be blocked 
1. If the browser showing the page is running on a virtual machine being accessed via a remote desktop applicaiton, rather than on a local box, additional configuration steps may be needed to have the remote desktop app redirect local audio to the VM
1. The Microsoft Cognitive Services Speech API key entered in the target page the iframe points to (`src` parameter) may be incorrect or expired

## Live sample

A sample of an iframe that is cross-origin, with a working microphone can be found here:
 
https://hyssostech.github.io/stp-docs/live/index.html
 
 
The `iframe` in that page points to an installed version of the STP sample app. Follow the [link](../gmaps) for details on capabilities, implementation and parameters.   

```html
<!DOCTYPE html>
<html>
  <head>
    <title>Sketch-thru-Plan Browser App iFrame wrapper</title>
   </head>
  <body>
    <h2>Hyssos Sketch-thru-Plan</h2>
    <p></p>
    <p></p>
    <p>Draw a Point, a Line or an Area by dragging the mouse to set the location of the symbol, and then speak the description of the symbol, for example:</p>
    <dl>
      <dt>- Draw a Point and speak "infantry company"</dt>
      <dt>- Draw a Line and speak "phase line blue"</dt>
      <dt>- Draw and Area and speak "objective bravo"</dt>
    </dl>
    <p></p>
    <p>Hold the CTRL key and drag the mouse to pan</p>
    <p>Refresh the browser page to clear the map</p>
    <p></p>
  <!--
   1) To embed an iframe in another (cross origin) page, you may need to explicitly allow access to the microphone:
   https://blog.addpipe.com/camera-and-microphone-access-in-cross-oirigin-iframes-with-feature-policy/
   2) You can select a different map extent as the default by using "lat", "lon" and "zomm" querystring parameters
   (coordinates in decimal degrees; zoom around 13-15)
   -->
   <iframe src="https://stp.hyssos.com/gmaps/index.html?lat=31.2732167&lon=-97.5714156&zoom=16"  allow="microphone" scrolling="no" width="100%" height="800"></iframe>
  </body>
</html>
```