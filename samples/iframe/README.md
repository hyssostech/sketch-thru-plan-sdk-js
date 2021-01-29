# Embedding an STP enabled page in an iFrame

Besides using the SDK to enable sketch and speech symbol creation on an editor, it is also possible to embed an existing app in an iFrame. 

To allow access to the microphone is situations in which the domain serving the hosting page is different than the embedded iframe's, a `allow="microphone"` property is required to signal to browsers that access is allowed:  

```html
<iframe src="https://server.com/stpapp"  allow="microphone" scrolling="no" width="100%" height="800"></iframe>
 ```
 
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