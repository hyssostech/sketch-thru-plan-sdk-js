# Role switching sample

This sample adds role switching capabilities to the  [Scenario](../scenario) sample.

For Prerequisites, Script references and Configuration, see the [gmaps sample README](../gmaps/README.md).


STP supports multiple roles - S2 (Intel), S3 (Operations), S4 (Logisitcs), Eng (Engineering), and FSO (Fires Support Officer). 
Selecting a role causes the following effects:

* A TO/ORBAT that matches the role's default affiliation (`hostile` for `S2`, `friend` for the rest) is loaded,
which activates the language model that supports the interpretation of the unit names as defined in the TO.
If none is available, the TO is cleared (meaning that no unit names are recognized).
* Symbols created while the role is selected are tagged: `creatorRole` symbol property is set accordingly.
* Additional filtering may happen in certain components, for example to bias recognition towards
language that is related to the `role`, or to present just role-related tasks in the `Symbol Guide` 


Capabilities illustrate by this sample include:

* Selecting a current Role 
* Handling Role switch notifications


## Code walkthrough

See the [gmaps sample](../gmaps) for details on most of the code. Here just the changes introduced in this sample - TO event handling - are described.

This sample adds a bare-bones interface for switching roles. 

Role methods return `Promises`, and need therefore to be handled via `async/await` 
or `then/catch` asynchronous code.
In this sample an `async/await` style is used.

All methods accept an optional `timeout` parameter, which sets the time in seconds after which the
operation is cancelled. 
Canceled operations cause the `Promise` to be `rejected`, triggering a `catch`, if one has been specified.
If not provided, a default of 30 seconds is used.  


### Switching to a new role

The `async setRole(role: StpRole, timeout?: number)` method sets the role for the current COA. 
If not COA exists, one is created.

In this simple sample, a call to the `setRole` method is issued whenever `onchange` is triggered by 
user selection of a radio button.

```javascript
    let currentRole = undefined;
    const roleRadioButtons = document.querySelectorAll("input[type='radio'][name=role]");
    for (rb in roleRadioButtons) {
        roleRadioButtons[rb].onchange = async () => {
            try {
                currentRole = document.querySelector("input[type='radio'][name=role]:checked").value;
                if (currentRole) {
                    // TODO: display some sort of progress indicator/wait cursor
                    await stpsdk.setRole(currentRole);
                    // TODO: save content to persistent storage
                    log("Set role to " + currentRole);
                }
                else {
                    log("No role selected");
                }
            } catch (error) {
                log(error, 'Error');
            }
        };
    }
```

Role switching results in potential loading of different language models related to the particular role and associated Task Org/ORBATs throughout STP components.
This operation may take some time to complete. If desired, the `timeout` parameter can be used
to extend/shorten the standard 30s timeout.

Roles currently supported by STP are defined in the `StpRoles` enumeration:

```javascript
/**
 * STP roles
 */
export enum StpRole {
  s2 = 'S2',
  s3 = 'S3',
  s4 = 'S4',
  fso = 'FSO',
  eng = 'ENG'
}
```