import {
    ETrackedDeviceClass,
    InputMessageKeyEnum,
    JsonDeviceIds,
    JsonDeviceProperty,
    JsonInputDigital,
    OutputMessage,
    OutputValueTypeEnum
} from 'openvr2ws-types'

export default class Site {
    private output: HTMLDivElement|null
    private input: HTMLDivElement|null
    private inputAnalog: HTMLDivElement|null
    private inputPose: HTMLDivElement|null
    private requests: HTMLDivElement|null
    private applicationInfo: HTMLDivElement|null
    private playArea: HTMLDivElement|null
    private properties: HTMLDivElement|null
    private remoteSettingOutput: HTMLDivElement|null
    private deviceIds: HTMLDivElement|null

    private websocket: WebSocket|undefined = undefined

    private port: number = 0
    private active = false
    private stop = false
    private inputStates: {[inputSource: number]: {[inputName: string]: boolean}} = {}
    private deviceProperties: { [deviceIndex: number]: {[propertyName: string]: any }} = {}
    private deviceIdsData: JsonDeviceIds = {DeviceToIndex: {}, SourceToIndex: {}}

    constructor() {
        console.log('Running!')
        const params = new URLSearchParams(window.location.search)
        let port = Number.parseInt(params.get('port') ?? '')
        if(isNaN(port)) port = 7708
        this.port = port

        this.output = document.querySelector<HTMLDivElement>("#output")
        this.applicationInfo = document.querySelector<HTMLDivElement>("#applicationInfo")
        this.properties = document.querySelector<HTMLDivElement>("#properties")
        this.playArea = document.querySelector<HTMLDivElement>("#playArea")
        this.deviceIds = document.querySelector<HTMLDivElement>("#deviceIds")
        this.input = document.querySelector<HTMLDivElement>("#input")
        this.inputAnalog = document.querySelector<HTMLDivElement>("#inputAnalog")
        this.inputPose = document.querySelector<HTMLDivElement>("#inputPose")

        this.requests = document.querySelector<HTMLDivElement>("#requests")
        this.remoteSettingOutput = document.querySelector<HTMLDivElement>('#remoteSettingOutput')

    }
    init() {
        setTimeout(()=> {
            this.connectLoop()
        }, 1000)
    }

    private connectLoop()
    {
        if(!this.active) {
            this.active = true
            if(this.websocket) this.websocket.close()
            this.websocket = new WebSocket(`ws://localhost:${this.port}`)
            this.websocket.onopen = this.onOpen.bind(this)
            this.websocket.onclose = this.onClose.bind(this)
            this.websocket.onmessage = this.onMessage.bind(this)
            this.websocket.onerror = this.onError.bind(this)
        }
        setTimeout(this.connectLoop, 5000)
    }

    public startRequestLoop() {
        this.stop = false
        this.requestLoop()
    }
    public stopRequestLoop() {
        this.stop = true
    }
    private requestLoop()
    {
        if(this.stop) return
        if(this.active) {
            this.requestAnalogInputData()
            this.requestPoseInputData()
        }
        setTimeout(this.requestLoop, 100)
    }

    private onOpen(_: Event)
    {
        console.log('Context in onOpen:', this)
        this.active = true
        this.writeToScreen("CONNECTED", true)
    }
    private onClose(_: CloseEvent)
    {
        this.active = false
        this.writeToScreen("DISCONNECTED")
    }
    private onMessage(evt: MessageEvent)
    {
        const data = JSON.parse(evt.data) as OutputMessage
        const text = JSON.stringify(data, null, 2)
        // console.log("Message: "+data.key+", data: "+text);
        // console.log("Message: "+data.key);
        if(data == null) this.writeToScreen(this.title("Response") + text)
        else {
            switch(data.Type) {
                case OutputValueTypeEnum.InputDigital: {
                    const inputData = data.Data as JsonInputDigital
                    if(typeof this.inputStates[inputData.Source] == 'undefined') this.inputStates[inputData.Source] = {}
                    this.inputStates[inputData.Source][inputData.Input] = inputData.State
                    if(this.input) this.input.innerHTML = this.title(data.Key.toString())+JSON.stringify(this.inputStates, null, 2)
                    break
                }
                case OutputValueTypeEnum.Result: {
                    switch(data.Key) {
                        case InputMessageKeyEnum.DeviceIds: {
                            const idData = data.Data as JsonDeviceIds
                            if(this.deviceIds) this.deviceIds.innerHTML = this.title(data.Key.toString())+text
                            this.deviceIdsData = idData
                            break
                        }
                        case InputMessageKeyEnum.InputAnalog: {
                            if(this.inputAnalog) this.inputAnalog.innerHTML = this.title(data.Key.toString())+text
                            break
                        }
                        case InputMessageKeyEnum.InputPose: {
                            if(this.inputPose) this.inputPose.innerHTML = this.title(data.Key.toString())+text
                            break
                        }
                        case InputMessageKeyEnum.ApplicationInfo: {
                            if(this.applicationInfo) this.applicationInfo.innerHTML = this.title(data.Key.toString())+text
                            break
                        }
                        case InputMessageKeyEnum.PlayArea: {
                            if(this.playArea) this.playArea.innerHTML = this.title(data.Key.toString())+text
                            break
                        }
                        case InputMessageKeyEnum.DeviceProperty: {
                            const propertyData = data.Data as JsonDeviceProperty
                            if(!this.deviceProperties.hasOwnProperty(propertyData.DeviceIndex)) this.deviceProperties[propertyData.DeviceIndex] = {}
                            this.deviceProperties[propertyData.DeviceIndex][propertyData.PropertyName] = propertyData.PropertyValue
                            if(this.properties) this.properties.innerHTML = JSON.stringify(this.deviceProperties, null, 2)
                            break
                        }
                        case InputMessageKeyEnum.RemoteSetting: {
                            if(this.remoteSettingOutput) this.remoteSettingOutput.innerHTML = this.title(data.Key.toString())+text
                            break
                        }
                        default: this.writeToScreen(this.title("Response") + text)
                    }
                }
            }
        }
    }

    private title(title: string): string {
        var now = new Date()
        var time = now.getHours() + ":" + now.getMinutes() + ":" + now.getSeconds()
        return time+" <strong>"+title+"</strong>:\n"
    }

    private onError(evt: Event)
    {
        this.writeToScreen('<span style="color: red;">ERROR:</span> ' + evt.toString())
    }

    private doSend(message: any)
    {
        const text = JSON.stringify(message);
        this.websocket?.send(text);
    }

    private writeToScreen(message: any, clear=false)
    {
        const p = document.createElement("p") as HTMLParagraphElement
        p.style.whiteSpace = 'break-spaces'
        p.innerHTML = message
        if(this.output) {
            if(clear) this.output.innerHTML = ""
            this.output.prepend(p)
        }
    }

    private requestProperties() {
        if(this.deviceIds) {
            const hmd = this.deviceIdsData.DeviceToIndex[ETrackedDeviceClass.HMD]
            const controllers = this.deviceIdsData.DeviceToIndex[ETrackedDeviceClass.Controller]
            const ids = (hmd ?? []).concat(controllers ?? [])
            for(const i of ids) {
                this.doSend({"key": "DeviceProperty", "value":"Prop_SerialNumber_String", "device":i})
            }
        }
    }

    private requestAnalogInputData() {
        this.doSend({"key": "InputAnalog", "value":"", "device":-1})
    }

    private requestPoseInputData() {
        this.doSend({"key": "InputPose", "value":"", "device":-1})
    }

    private requestDeviceIds() {
        this.doSend({"key": "DeviceIds"})
    }

    private requestPlayArea() {
        this.doSend({"key": "PlayArea"})
    }

    private async sha256(message: string) {
        const textBuffer = new TextEncoder().encode(message) // encode as UTF-8
        const hashBuffer = await crypto.subtle.digest('SHA-256', textBuffer) // hash the message
        const byteArray = Array.from(new Uint8Array(hashBuffer)) // convert ArrayBuffer to Array
        return btoa(String.fromCharCode(...byteArray))  // b64 encode byte array
    }

    private sendRemoteSetting() {
        const password = document.querySelector<HTMLInputElement>('#password')?.value ?? ''
        const section = document.querySelector<HTMLInputElement>('#section')?.value ?? ''
        const setting = document.querySelector<HTMLInputElement>('#setting')?.value ?? ''
        const value = document.querySelector<HTMLInputElement>('#value')?.value ?? ''
        const type = document.querySelector<HTMLInputElement>('#type')?.value ?? ''
        this.sha256(password).then(passwordHash => {
            this.doSend({
                key: 'RemoteSetting',
                value: passwordHash,
                value2: section,
                value3: setting,
                value4: value,
                value5: type
            })
        })
    }
}