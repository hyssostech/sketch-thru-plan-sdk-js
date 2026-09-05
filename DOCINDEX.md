# Sketch-thru-Plan Javascript SDK

## Sketch-thru-Plan

Sketch-thru-Plan (STP) is a Natural Language Planning Engine that analyzes combined speech and sketches and produces interpretations of user intentions in terms of symbols placed on a map, and higher-level constructs that correlate multiple symbols into intended actions (or tasks). 

STP is a *multimodal* system - it produces interpretations based on multiple kinds of user input, most commonly speech and sketch. The interpretations combine these modalities, for example, identifying a location from the sketch, and the intended semantics from the speech, for instance when a user sketches a line and says "phase line blue".

STP is a generic engine, which can be configured to provide interpretations in multiple domains. The primary area of application is military planning, supporting fast creation of Courses of Action (COAs). STP enhances user cognition by letting them focus on the creative aspect of planning, keeping focus on the task, not the tool.

Plans designed in STP are executable with little additional user intervention other than the symbol laydown using speech and sketch. The resulting plans are ready to be sent to simulators for adjudication, and to Command and Control (C2) systems.

## Table of Contents

| Class                   | Description                                                             |
| ----------------------- | ----------------------------------------------------------------------- |
| [StpRecognizer](classes/stprecognizer.html) | Main class exposing the SDK services |
| [IStpConnector](interfaces/isptpconnector.html) | Interface to STP connector plugins |
| [StpConnector](classes/stpwebsocketsconnector.html) | STP connector plugin implementation - Websockets connection to STP's Publish/Subscribe system|
| [ISpeechRecognizer](interfaces/ispeechrecognizer.html) | Interface to speech recognition plugins |


## Resources 

Quickstart and samples are available in https://github.com/hyssostech/sketch-thru-plan-sdk-js 
