///////////////////////////////////////////////////////////////////////////////
//
//	TONE.js
//
//	@author Yotam Mann
//	
//	The MIT License (MIT) 2014
///////////////////////////////////////////////////////////////////////////////

(function (root) {
	// Tone.js can run with or without requirejs
	//
	// this anonymous function checks to see if the 'define'
	// method exists, if it does not (and there is not already
	// something called Tone) it will create a function called
	// 'define'. 'define' will invoke the 'core' module and attach
	// its return value to the root. for all other modules
	// Tone will be passed in as the argument.
	if (typeof define !== "function" && 
		typeof root.Tone !== "function") {
		//define 'define' to invoke the callbacks with Tone
		root.define = function(name, deps, func){
			//grab the one at the root
			if (name === "Tone/core/Tone"){
				root.Tone = func();
			} else {
				//for all others pass it in
				func(root.Tone);
			}
		};
	}
} (this));

define("Tone/core/Tone", [], function(){

	//////////////////////////////////////////////////////////////////////////
	//	WEB AUDIO CONTEXT
	///////////////////////////////////////////////////////////////////////////

	//ALIAS
	if (!AudioContext){
		AudioContext = webkitAudioContext;
	} 

	var audioContext;
	if (AudioContext){
		audioContext = new AudioContext();
	}

	//SHIMS////////////////////////////////////////////////////////////////////

	if (typeof AudioContext.prototype.createGain !== "function"){
		AudioContext.prototype.createGain = AudioContext.prototype.createGainNode;
	}
	if (typeof AudioContext.prototype.createDelay !== "function"){
		AudioContext.prototype.createDelay = AudioContext.prototype.createDelayNode;
	}

	if (typeof AudioBufferSourceNode.prototype.start !== "function"){
		AudioBufferSourceNode.prototype.start = AudioBufferSourceNode.prototype.noteGrainOn;
	}
	if (typeof AudioBufferSourceNode.prototype.stop !== "function"){
		AudioBufferSourceNode.prototype.stop = AudioBufferSourceNode.prototype.noteOff;
	}
	if (typeof OscillatorNode.prototype.start !== "function"){
		OscillatorNode.prototype.start = OscillatorNode.prototype.noteOn;
	}
	if (typeof OscillatorNode.prototype.stop !== "function"){
		OscillatorNode.prototype.stop = OscillatorNode.prototype.noteOff;	
	}
	//extend the connect function to include Tones
	AudioNode.prototype._nativeConnect = AudioNode.prototype.connect;
	AudioNode.prototype.connect = function(B){
		if (B.input && B.input instanceof GainNode){
			this._nativeConnect(B.input);
		} else {
			try {
				this._nativeConnect.apply(this, arguments);
			} catch (e) {
				throw new Error("trying to connect to a node with no inputs");
			}
		}
	};

	///////////////////////////////////////////////////////////////////////////
	//	TONE
	///////////////////////////////////////////////////////////////////////////

	/**
	 *  Tone is the baseclass of all ToneNodes
	 *  From Tone, children inherit timing and math which is used throughout Tone.js
	 *  
	 *  @constructor
	 *  @alias Tone
	 */
	var Tone = function(){
		/**
		 *  default input of the ToneNode
		 *  
		 *  @type {GainNode}
		 */
		this.input = this.context.createGain();
		/**
		 *  default output of the ToneNode
		 *  
		 *  @type {GainNode}
		 */
		this.output = this.context.createGain();
	};

	///////////////////////////////////////////////////////////////////////////
	//	CLASS VARS
	///////////////////////////////////////////////////////////////////////////

	/**
	 *  A static pointer to the audio context
	 *  @type {AudioContext}
	 */
	Tone.context = audioContext;

	/**
	 *  A static pointer to the audio context
	 *  @type {AudioContext}
	 */
	Tone.prototype.context = Tone.context;

	/**
	 *  the default buffer size
	 *  @type {number}
	 */
	Tone.prototype.bufferSize = 2048;

	/**
	 *  the default resolution for WaveShaperNodes
	 *  @type {number}
	 */
	Tone.prototype.waveShaperResolution = 1024;
	
	///////////////////////////////////////////////////////////////////////////
	//	CONNECTIONS
	///////////////////////////////////////////////////////////////////////////

	/**
	 *  connect the output of a ToneNode to an AudioParam, AudioNode, or ToneNode
	 *  @param  {Tone | AudioParam | AudioNode} unit 
	 */
	Tone.prototype.connect = function(unit){
		this.output.connect(unit);
	};

	/**
	 *  disconnect the output
	 */
	Tone.prototype.disconnect = function(){
		this.output.disconnect();
	};
	
	/**
	 *  connect together all of the arguments in series
	 *  @param {...AudioParam|Tone}
	 */
	Tone.prototype.chain = function(){
		if (arguments.length > 1){
			var currentUnit = arguments[0];
			for (var i = 1; i < arguments.length; i++){
				var toUnit = arguments[i];
				currentUnit.connect(toUnit);
				currentUnit = toUnit;
			}
		}
	};

	///////////////////////////////////////////////////////////////////////////
	//	UTILITIES / HELPERS / MATHS
	///////////////////////////////////////////////////////////////////////////

	//borrowed from underscore.js
	function isUndef(val){
		return val === void 0;
	}

	/**
	 *  if a the given is undefined, use the fallback
	 *  
	 *  @param  {*} given    
	 *  @param  {*} fallback 
	 *  @return {*}          
	 */
	Tone.prototype.defaultArg = function(given, fallback){
		return isUndef(given) ? fallback : given;
	};

	/**
	 *  equal power gain scale
	 *  good for cross-fading
	 *  	
	 *  @param  {number} percent (0-1)
	 *  @return {number}         output gain (0-1)
	 */
	Tone.prototype.equalPowerScale = function(percent){
		var piFactor = 0.5 * Math.PI;
		return Math.sin(percent * piFactor);
	};

	/**
	 *  @param  {number} gain (0-1)
	 *  @return {number}      gain (decibel scale but betwee 0-1)
	 */
	Tone.prototype.logScale = function(gain) {
		return  Math.max(this.normalize(this.gainToDb(gain), -100, 0), 0);
	};

	/**
	 *  @param  {number} gain (0-1)
	 *  @return {number}      gain (decibel scale but betwee 0-1)
	 */
	Tone.prototype.expScale = function(gain) {
		return this.dbToGain(this.interpolate(gain, -100, 0));
	};

	/**
	 *  convert db scale to gain scale (0-1)
	 *  @param  {number} db
	 *  @return {number}   
	 */
	Tone.prototype.dbToGain = function(db) {
		return Math.pow(2, db / 6);
	};

	/**
	 *  convert gain scale to decibels
	 *  @param  {number} gain (0-1)
	 *  @return {number}   
	 */
	Tone.prototype.gainToDb = function(gain) {
		return  20 * (Math.log(gain) / Math.LN10);
	};

	/**
	 *  interpolate the input value (0-1) to be between outputMin and outputMax
	 *  @param  {number} input     
	 *  @param  {number} outputMin 
	 *  @param  {number} outputMax 
	 *  @return {number}           
	 */
	Tone.prototype.interpolate = function(input, outputMin, outputMax){
		return input*(outputMax - outputMin) + outputMin;
	};

	/**
	 *  normalize the input to 0-1 from between inputMin to inputMax
	 *  @param  {number} input    
	 *  @param  {number} inputMin 
	 *  @param  {number} inputMax 
	 *  @return {number}          
	 */
	Tone.prototype.normalize = function(input, inputMin, inputMax){
		//make sure that min < max
		if (inputMin > inputMax){
			var tmp = inputMax;
			inputMax = inputMin;
			inputMin = tmp;
		} else if (inputMin == inputMax){
			return 0;
		}
		return (input - inputMin) / (inputMax - inputMin);
	};

	/**
	 *  a dispose method 
	 *  
	 *  @abstract
	 */
	Tone.prototype.dispose = function(){};


	///////////////////////////////////////////////////////////////////////////
	//	TIMING
	///////////////////////////////////////////////////////////////////////////

	/**
	 *  @return {number} the currentTime from the AudioContext
	 */
	Tone.prototype.now = function(){
		return this.context.currentTime;
	};

	/**
	 *  convert a sample count to seconds
	 *  @param  {number} samples 
	 *  @return {number}         
	 */
	Tone.prototype.samplesToSeconds = function(samples){
		return samples / this.context.sampleRate;
	};

	/**
	 *  convert a time into samples
	 *  
	 *  @param  {Tone.time} time
	 *  @return {number}         
	 */
	Tone.prototype.toSamples = function(time){
		var seconds = this.toSeconds(time);
		return seconds * this.context.sampleRate;
	};

	/**
	 *  convert Tone.Time to seconds
	 *
	 *  this is a simplified version which only handles numbers and 
	 *  'now' relative numbers. If the Transport is included this 
	 *  method is overridden to include many other features including 
	 *  notationTime, Frequency, and transportTime
	 *  
	 *  @param  {Tone.Time} time 
	 *  @return {number}     
	 */
	Tone.prototype.toSeconds = function(time){
		if (typeof time === "number"){
			return time; //assuming that it's seconds
		} else if (typeof time === "string"){
			var plusTime = 0;
			if(time.charAt(0) === "+") {
				plusTime = this.now();
				time = time.slice(1);				
			} 
			return parseFloat(time) + plusTime;
		} else {
			return this.now();
		}
	};


	/**
	 *  convert a frequency into seconds
	 *  accepts both numbers and strings 
	 *  	i.e. 10hz or 10 both equal .1
	 *  
	 *  @param  {number|string} freq 
	 *  @return {number}      
	 */
	Tone.prototype.frequencyToSeconds = function(freq){
		return 1 / parseFloat(freq);
	};

	/**
	 *  convert a number in seconds to a frequency
	 *  @param  {number} seconds 
	 *  @return {number}         
	 */
	Tone.prototype.secondsToFrequency = function(seconds){
		return 1/seconds;
	};

	///////////////////////////////////////////////////////////////////////////
	//	STATIC METHODS
	///////////////////////////////////////////////////////////////////////////
		
	/**
	 *  have a child inherit all of Tone's (or a parent's) prototype
	 *  to inherit the parent's properties, make sure to call 
	 *  Parent.call(this) in the child's constructor
	 *
	 *  based on closure library's inherit function
	 *  
	 *  @param  {function} 	child  
	 *  @param  {function=} parent (optional) parent to inherit from
	 *                             if no parent is supplied, the child
	 *                             will inherit from Tone
	 */
	Tone.extend = function(child, parent){
		if (isUndef(parent)){
			parent = Tone;
		}
		function tempConstructor(){}
		tempConstructor.prototype = parent.prototype;
		child.prototype = new tempConstructor();
		/** @override */
		child.prototype.constructor = child;
	};

	return Tone;

});

define('Tone/signal/Signal',["Tone/core/Tone"], function(Tone){

	//all signals share a common constant signal generator
	/**
	 *  @static
	 *  @private
	 *  @type {OscillatorNode} 
	 */
	var generator = Tone.context.createOscillator();

	/**
	 *  @static
	 *  @private
	 *  @type {WaveShaperNode} 
	 */
	var constant = Tone.context.createWaveShaper();

	//generate the waveshaper table which outputs 1 for any input value
	(function(){
		var len = 8;
		var curve = new Float32Array(len);
		for (var i = 0; i < len; i++){
			//all inputs produce the output value
			curve[i] = 1;
		}
		constant.curve = curve;
	})();

	generator.connect(constant);
	generator.start(0);

	/**
	 *  constant audio-rate signal
	 *
	 *  Tone.Signal is a core component which allows for synchronization of many components. 
	 *  A single signal can drive multiple parameters by applying Scaling. 
	 *
	 *  For example: to synchronize two Tone.Oscillators in octaves of each other, 
	 *  	Signal --> OscillatorA.frequency
	 *  		  ^--> Tone.Multiply(2) --> OscillatorB.frequency
	 *  
	 *
	 *  Tone.Signal can be scheduled with all of the functions available to AudioParams
	 *
	 *
	 *  @constructor
	 *  @extends {Tone}
	 *  @param {number=} value (optional) initial value
	 */
	Tone.Signal = function(value){
		/**
		 *  scales the constant output to the desired output
		 *  @type {GainNode}
		 */
		this.scalar = this.context.createGain();
		/**
		 *  the output node
		 *  @type {GainNode}
		 */
		this.output = this.context.createGain();
		/**
		 *  the ratio of the this value to the control signal value
		 *
		 *  @private
		 *  @type {number}
		 */
		this._syncRatio = 1;

		//connect the constant 1 output to the node output
		this.chain(constant, this.scalar, this.output);

		//set the default value
		this.setValue(this.defaultArg(value, 0));
	};

	Tone.extend(Tone.Signal);

	/**
	 *  @return {number} the current value of the signal
	 */
	Tone.Signal.prototype.getValue = function(){
		return this.scalar.gain.value;
	};

	/**
	 *  set the value of the signal right away
	 *  will be overwritten if there are previously scheduled automation curves
	 *  
	 *  @param {number} value 
	 */
	Tone.Signal.prototype.setValue = function(value){
		if (this._syncRatio === 0){
			value = 0;
		} else {
			value *= this._syncRatio;
		}
		this.scalar.gain.value = value;
	};

	/**
	 *  Schedules a parameter value change at the given time.
	 *  
	 *  @param {number}		value 
	 *  @param {Tone.Time}  time 
	 */
	Tone.Signal.prototype.setValueAtTime = function(value, time){
		value *= this._syncRatio;
		this.scalar.gain.setValueAtTime(value, this.toSeconds(time));
	};

	/**
	 *  creates a schedule point with the current value at the current time
	 *
	 *  @param {number=} now (optionally) pass the now value in
	 *  @returns {number} the current value
	 */
	Tone.Signal.prototype.setCurrentValueNow = function(now){
		now = this.defaultArg(now, this.now());
		var currentVal = this.getValue();
		this.cancelScheduledValues(now);
		this.scalar.gain.setValueAtTime(currentVal, now);
		return currentVal;
	};

	/**
	 *  Schedules a linear continuous change in parameter value from the 
	 *  previous scheduled parameter value to the given value.
	 *  
	 *  @param  {number} value   
	 *  @param  {Tone.Time} endTime 
	 */
	Tone.Signal.prototype.linearRampToValueAtTime = function(value, endTime){
		value *= this._syncRatio;
		this.scalar.gain.linearRampToValueAtTime(value, this.toSeconds(endTime));
	};

	/**
	 *  Schedules an exponential continuous change in parameter value from 
	 *  the previous scheduled parameter value to the given value.
	 *  
	 *  @param  {number} value   
	 *  @param  {Tone.Time} endTime 
	 */
	Tone.Signal.prototype.exponentialRampToValueAtTime = function(value, endTime){
		value *= this._syncRatio;
		this.scalar.gain.exponentialRampToValueAtTime(value, this.toSeconds(endTime));
	};

	/**
	 *  Schedules an exponential continuous change in parameter value from 
	 *  the current time and current value to the given value.
	 *  
	 *  @param  {number} value   
	 *  @param  {Tone.Time} endTime 
	 */
	Tone.Signal.prototype.exponentialRampToValueNow = function(value, endTime){
		var now = this.now();
		this.setCurrentValueNow(now);
		value *= this._syncRatio;
		//make sure that the endTime doesn't start with +
		if (endTime.toString().charAt(0) === "+"){
			endTime = endTime.substr(1);
		}
		this.scalar.gain.exponentialRampToValueAtTime(value, now + this.toSeconds(endTime));
	};

	/**
	 *  Schedules an linear continuous change in parameter value from 
	 *  the current time and current value to the given value at the given time.
	 *  
	 *  @param  {number} value   
	 *  @param  {Tone.Time} endTime 
	 */
	Tone.Signal.prototype.linearRampToValueNow = function(value, endTime){
		var now = this.now();
		this.setCurrentValueNow(now);
		value *= this._syncRatio;
		//make sure that the endTime doesn't start with +
		if (endTime.toString().charAt(0) === "+"){
			endTime = endTime.substr(1);
		}
		this.scalar.gain.linearRampToValueAtTime(value, now + this.toSeconds(endTime));
	};

	/**
	 *  Start exponentially approaching the target value at the given time with
	 *  a rate having the given time constant.
	 *  	
	 *  @param {number} value        
	 *  @param {Tone.Time} startTime    
	 *  @param {number} timeConstant 
	 */
	Tone.Signal.prototype.setTargetAtTime = function(value, startTime, timeConstant){
		value *= this._syncRatio;
		this.output.gain.setTargetAtTime(value, this.toSeconds(startTime), timeConstant);
	};

	/**
	 *  Sets an array of arbitrary parameter values starting at the given time
	 *  for the given duration.
	 *  	
	 *  @param {Array<number>} values    
	 *  @param {Tone.Time} startTime 
	 *  @param {Tone.Time} duration  
	 */
	Tone.Signal.prototype.setValueCurveAtTime = function(values, startTime, duration){
		for (var i = 0; i < values.length; i++){
			values[i] *= this._syncRatio;
		}
		this.scalar.gain.setValueCurveAtTime(values, this.toSeconds(startTime), this.toSeconds(duration));
	};

	/**
	 *  Cancels all scheduled parameter changes with times greater than or 
	 *  equal to startTime.
	 *  
	 *  @param  {Tone.Time} startTime
	 */
	Tone.Signal.prototype.cancelScheduledValues = function(startTime){
		this.scalar.gain.cancelScheduledValues(this.toSeconds(startTime));
	};

	/**
	 *  Sync this to another signal and it will always maintain the 
	 *  ratio between the two signals until it is unsynced
	 *  
	 *  @param  {Tone.Signal} signal to sync to
	 */
	Tone.Signal.prototype.sync = function(signal){
		//get the sync ratio
		if (signal.getValue() !== 0){
			this._syncRatio = this.getValue() / signal.getValue();
		} else {
			this._syncRatio = 0;
		}
		//make a new scalar which is not connected to the constant signal
		this.scalar.disconnect();
		this.scalar = this.context.createGain();
		this.chain(signal, this.scalar, this.output);
		//set it ot the sync ratio
		this.scalar.gain.value = this._syncRatio;
	};

	/**
	 *  unbind the signal control
	 *
	 *  will leave the signal value as it was without the influence of the control signal
	 */
	Tone.Signal.prototype.unsync = function(){
		//make a new scalar so that it's disconnected from the control signal
		//get the current gain
		var currentGain = this.getValue();
		this.scalar.disconnect();
		this.scalar = this.context.createGain();
		this.scalar.gain.value = currentGain / this._syncRatio;
		this._syncRatio = 1;
		//reconnect things up
		this.chain(constant, this.scalar, this.output);
	};

	/**
	 *  internal dispose method to tear down the node
	 *  
	 *  @override
	 */
	Tone.Signal.prototype.dispose = function(){
		//disconnect everything
		this.output.disconnect();
		this.scalar.disconnect();
		this.output = null;
		this.scalar = null;
	};

	return Tone.Signal;
});
define('Tone/signal/Add',["Tone/core/Tone", "Tone/signal/Signal"], function(Tone){

	/**
	 *  Adds a value to an incoming signal
	 *
	 *  @constructor
	 *  @extends {Tone}
	 *  @param {number} value
	 */
	Tone.Add = function(value){
		Tone.call(this);

		/**
		 *  @private
		 *  @type {Tone}
		 */
		this._value = new Tone.Signal(value);

		//connections
		this.chain(this._value, this.input, this.output);
	};

	Tone.extend(Tone.Add);

	/**
	 *  set the constant
	 *  
	 *  @param {number} value 
	 */
	Tone.Add.prototype.setValue = function(value){
		this._value.setValue(value);
	}; 

	/**
	 *  dispose method
	 */
	Tone.Add.prototype.dispose = function(){
		this._value.dispose();
		this.input.disconnect();
		this.output.disconnect();
		this._value = null;
		this.input = null;
		this.output = null;
	}; 

	return Tone.Add;
});
define('Tone/signal/Multiply',["Tone/core/Tone", "Tone/signal/Signal"], function(Tone){

	/**
	 *  Multiply the incoming signal by some factor
	 *
	 *  @constructor
	 *  @extends {Tone}
	 *  @param {number=} value constant value to multiple
	 */
	Tone.Multiply = function(value){
		/**
		 *  the input node is the same as the output node
		 *  it is also the GainNode which handles the scaling of incoming signal
		 *  
		 *  @type {GainNode}
		 */
		this.input = this.context.createGain();
		/** @alias {GainNode} */
		this.output = this.input;

		//apply the inital scale factor
		this.input.gain.value = this.defaultArg(value, 1);
	};

	Tone.extend(Tone.Multiply);

	/**
	 *  set the constant multiple
	 *  	
	 *  @param {number} value 
	 */
	Tone.Multiply.prototype.setValue = function(value){
		this.input.gain.value = value;
	};

	/**
	 *  clean up
	 */
	Tone.Multiply.prototype.dispose = function(){
		this.input.disconnect();
		this.input = null;
	}; 

	return Tone.Multiply;
});

define('Tone/signal/Scale',["Tone/core/Tone", "Tone/signal/Add", "Tone/signal/Multiply"], function(Tone){
	
	/**
	 *  performs a linear scaling on an input signal
	 *
	 *  scales from the input range of inputMin to inputMax 
	 *  to the output range of outputMin to outputMax
	 *
	 *  if only two arguments are provided, the inputMin and inputMax are set to -1 and 1
	 *
	 *  @constructor
	 *  @extends {Tone}
	 *  @param {number} inputMin  
	 *  @param {number} inputMax  
	 *  @param {number=} outputMin 
	 *  @param {number=} outputMax 
	 */
	Tone.Scale = function(inputMin, inputMax, outputMin, outputMax){
		Tone.call(this);

		//if there are only two args
		if (arguments.length == 2){
			outputMin = inputMin;
			outputMax = inputMax;
			inputMin = -1;
			inputMax = 1;
		}

		/** @private 
			@type {number} */
		this._inputMin = inputMin;
		/** @private 
			@type {number} */
		this._inputMax = inputMax;
		/** @private 
			@type {number} */
		this._outputMin = outputMin;
		/** @private 
			@type {number} */
		this._outputMax = outputMax;


		/** @private 
			@type {Tone.Add} */
		this._plusInput = new Tone.Add(0);
		/** @private 
			@type {Tone.Multiply} */
		this._scale = new Tone.Multiply(1);
		/** @private 
			@type {Tone.Add} */
		this._plusOutput = new Tone.Add(0);

		//connections
		this.chain(this.input, this._plusInput, this._scale, this._plusOutput, this.output);

		//set the scaling values
		this._setScalingParameters();
	};

	Tone.extend(Tone.Scale);

	/**
	 *  set the scaling parameters
	 *  
	 *  @private
	 */
	Tone.Scale.prototype._setScalingParameters = function(){
		//components
		this._plusInput.setValue(-this._inputMin);
		this._scale.setValue((this._outputMax - this._outputMin)/(this._inputMax - this._inputMin));
		this._plusOutput.setValue(this._outputMin);
	};

	/**
	 *  set the input min value
	 *  @param {number} val 
	 */
	Tone.Scale.prototype.setInputMin = function(val){
		this._inputMin = val;
		this._setScalingParameters();
	};

	/**
	 *  set the input max value
	 *  @param {number} val 
	 */
	Tone.Scale.prototype.setInputMax = function(val){
		this._inputMax = val;
		this._setScalingParameters();
	};

	/**
	 *  set the output min value
	 *  @param {number} val 
	 */
	Tone.Scale.prototype.setOutputMin = function(val){
		this._outputMin = val;
		this._setScalingParameters();
	};

	/**
	 *  set the output max value
	 *  @param {number} val 
	 */
	Tone.Scale.prototype.setOutputMax = function(val){
		this._outputMax = val;
		this._setScalingParameters();
	};

	/**
	 *  clean up
	 */
	Tone.Scale.prototype.dispose = function(){
		this.input.disconnect();
		this.output.disconnect();
		this._plusInput.dispose();
		this._plusOutput.dispose();
		this._scale.dispose();
		this.input = null;
		this.output = null;
		this._plusInput = null;
		this._plusOutput = null;
		this._scale = null;
	}; 


	return Tone.Scale;
});

define('Tone/component/DryWet',["Tone/core/Tone", "Tone/signal/Signal", "Tone/signal/Scale"], function(Tone){

	/**
	 * DRY/WET KNOB
	 * 
	 * equal power fading control values:
	 * 	0 = 100% dry  -    0% wet
	 * 	1 =   0% dry  -  100% wet
	 *
	 * @constructor
	 * @param {number} initialDry
	 */		
	Tone.DryWet = function(initialDry){
		Tone.call(this);

		/**
		 *  connect this input to the dry signal
		 *  the dry signal is also the default input
		 *  
		 *  @type {GainNode}
		 */
		this.dry = this.input;

		/**
		 *  connect this input to the wet signal
		 *  
		 *  @type {GainNode}
		 */
		this.wet = this.context.createGain();
		/**
		 *  controls the amount of wet signal 
		 *  which is mixed into the dry signal
		 *  
		 *  @type {GainNode}
		 */
		this.wetness = new Tone.Signal(0);
		/**
		 *  invert the incoming signal
		 *  @private
		 *  @type {Tone}
		 */
		this._invert = new Tone.Scale(0, 1, 1, 0);

		//connections
		this.dry.connect(this.output);
		this.wet.connect(this.output);
		//wet control
		this.chain(this.wetness, this._invert, this.wet.gain);
		//dry control
		this.chain(this.wetness, this.dry.gain);
	};

	Tone.extend(Tone.DryWet);

	/**
	 * Set the dry value 
	 * 
	 * @param {number} val
	 * @param {Tone.Time} rampTime
	 */
	Tone.DryWet.prototype.setDry = function(val, rampTime){
		rampTime = this.defaultArg(rampTime, 0);
		this.wetness.linearRampToValueAtTime(val, this.toSeconds(rampTime));
	};

	/**
	 * Set the wet value
	 * 
	 * @param {number} val
	 * @param {Tone.Time} rampTime
	 */
	Tone.DryWet.prototype.setWet = function(val, rampTime){
		this.setDry(1-val, rampTime);
	};

	/**
	 *  clean up
	 */
	Tone.DryWet.prototype.dispose = function(){
		this.dry.disconnect();
		this.wet.disconnect();
		this.wetness.dispose();
		this._invert.dispose();
		this.output.disconnect();
		this.dry = null;
		this.wet = null;
		this.wetness = null;
		this._invert = null;
		this.output = null;
	};

	return Tone.DryWet;
});

define('Tone/component/Envelope',["Tone/core/Tone", "Tone/signal/Signal"], function(Tone){

	/**
	 *  Envelope 
	 *  ADR envelope generator attaches to an AudioParam
	 *
	 *  @constructor
	 *  @extends {Tone}
	 *  @param {Tone.Time=} attack
	 *  @param {Tone.Time=} decay
	 *  @param {number=} sustain 	a percentage (0-1) of the full amplitude
	 *  @param {Tone.Time=} release
	 *  @param {number=} minOutput the lowest point of the envelope
	 *  @param {number=} maxOutput the highest point of the envelope
	 */
	Tone.Envelope = function(attack, decay, sustain, release, minOutput, maxOutput){
		//extend Unit
		Tone.call(this);

		//set the parameters
		this.attack = this.defaultArg(attack, 0.01);
		this.decay = this.defaultArg(decay, 0.1);
		this.release = this.defaultArg(release, 1);
		this.sustain = this.defaultArg(sustain, 0.5);

		this.min = this.defaultArg(minOutput, 0);
		this.max = this.defaultArg(maxOutput, 1);
		
		//the control signal
		this.control = new Tone.Signal(this.min);

		//connections
		this.chain(this.control, this.output);
	};

	Tone.extend(Tone.Envelope);

	/**
	 * attack->decay->sustain linear ramp
	 * @param  {Tone.Time} time
	 */
	Tone.Envelope.prototype.triggerAttack = function(time){
		var startVal = this.min;
		if (!time){
			startVal = this.control.getValue();
		}
		time = this.defaultArg(time, this.now());
		time = this.toSeconds(time);
		this.control.cancelScheduledValues(time);
		this.control.setValueAtTime(startVal, time);
		var attackTime = this.toSeconds(this.attack);
		var decayTime = this.toSeconds(this.decay);
		this.control.linearRampToValueAtTime(this.max, time + attackTime);
		var sustainVal = (this.max - this.min) * this.sustain + this.min;
		this.control.linearRampToValueAtTime(sustainVal, time + attackTime + decayTime);
	};

	/**
	 * attack->decay->sustain exponential ramp
	 * @param  {Tone.Time} time
	 */
	Tone.Envelope.prototype.triggerAttackExp = function(time){
		var startVal = this.min;
		if (!time){
			startVal = this.control.getValue();
		}
		time = this.toSeconds(time);
		this.control.cancelScheduledValues(time);
		this.control.setValueAtTime(startVal, time);
		var attackTime = this.toSeconds(this.attack);
		var decayTime = this.toSeconds(this.decay);
		this.control.linearRampToValueAtTime(this.max, time + attackTime);
		var sustainVal = (this.max - this.min) * this.sustain + this.min;
		this.control.exponentialRampToValueAtTime(sustainVal, time + attackTime + decayTime);
	};

	
	/**
	 * triggers the release of the envelope with a linear ramp
	 * @param  {Tone.Time} time
	 */
	Tone.Envelope.prototype.triggerRelease = function(time){
		var startVal = this.control.getValue();
		if (time){
			startVal = (this.max - this.min) * this.sustain + this.min;
		}
		time = this.toSeconds(time);
		this.control.cancelScheduledValues(time);
		this.control.setValueAtTime(startVal, time);
		this.control.linearRampToValueAtTime(this.min, time + this.toSeconds(this.release));
	};


	/**
	 * triggers the release of the envelope with an exponential ramp
	 * 
	 * @param  {Tone.Time} time
	 */
	Tone.Envelope.prototype.triggerReleaseExp = function(time){
		var startVal = this.control.getValue();
		if (time){
			startVal = (this.max - this.min) * this.sustain + this.min;
		}
		time = this.toSeconds(time);
		this.control.cancelScheduledValues(time);
		this.control.setValueAtTime(startVal, time);
		this.control.exponentialRampToValueAtTime(this.min, time + this.toSeconds(this.release));
	};

	/**
	 * 	pointer to the parent's connect method
	 * 	@private
	 */
	Tone.Envelope.prototype._connect = Tone.prototype.connect;

	/**
	 * connect the envelope
	 * 
	 * if the envelope is connected to a param, the params 
	 * value will be set to 0 so that it doesn't interfere with the envelope
	 * 
	 * @param  {number} param
	 */
	Tone.Envelope.prototype.connect = function(param){
		if (param instanceof AudioParam){
			//set the initial value
			param.value = 0;
		} 
		this._connect(param);
	};

	return Tone.Envelope;
});

define('Tone/core/Master',["Tone/core/Tone"], function(Tone){
	
	/**
	 *  Master Output
	 *  
	 *  a single master output
	 *  adds toMaster to Tone
	 *
	 *  @constructor
	 *  @extends {Tone}
	 */
	var Master = function(){
		//extend audio unit
		Tone.call(this);

		/**
		 *  put a hard limiter on the output so we don't blow any eardrums
		 *  
		 *  @type {DynamicsCompressorNode}
		 */
		this.limiter = this.context.createDynamicsCompressor();
		this.limiter.threshold.value = 0;
		this.limiter.ratio.value = 20;
		//connect it up
		this.chain(this.input, this.limiter, this.output, this.context.destination);
	};

	Tone.extend(Master);

	/**
	 *  mute the output
	 *  @param {boolean} muted
	 */
	Master.prototype.mute = function(muted){
		muted = this.defaultArg(muted, true);
		if (muted){
			this.output.gain.value = 0;
		} else {
			this.output.gain.value = 1;
		}
	};

	///////////////////////////////////////////////////////////////////////////
	//	AUGMENT TONE's PROTOTYPE
	///////////////////////////////////////////////////////////////////////////

	/**
	 *  connect 'this' to the master output
	 */
	Tone.prototype.toMaster = function(){
		this.connect(Tone.Master);
	};

	/**
	 *  Also augment AudioNode's prototype to include toMaster
	 *  as a convenience
	 */
	AudioNode.prototype.toMaster = function(){
		this.connect(Tone.Master);
	};

	/**
	 *  a silent connection to the DesinationNode
	 *  which will ensure that anything connected to it
	 *  will not be garbage collected
	 *  
	 *  @private
	 */
	var _silentNode = Tone.context.createGain();
	_silentNode.gain.value = 0;
	_silentNode.connect(Tone.context.destination);

	/**
	 *  makes a connection to ensure that the node will not be garbage collected
	 *  until 'dispose' is explicitly called
	 *
	 *  use carefully. circumvents JS and WebAudio's normal Garbage Collection behavior
	 */
	Tone.prototype.noGC = function(){
		this.output.connect(_silentNode);
	};

	AudioNode.prototype.noGC = function(){
		this.connect(_silentNode);
	};

	//a single master output
	Tone.Master = new Master();

	return Tone.Master;
});
define('Tone/core/Transport',["Tone/core/Tone", "Tone/core/Master", "Tone/signal/Signal"], 
function(Tone){

	/**
	 *  oscillator-based transport allows for simple musical timing
	 *  supports tempo curves and time changes
	 *
	 *  @constructor
	 *  @extends {Tone}
	 */
	Tone.Transport = function(){

		/**
		 *  watches the main oscillator for timing ticks
		 *  
		 *  @private
		 *  @type {ScriptProcessorNode}
		 */
		this._jsNode = this.context.createScriptProcessor(this.bufferSize, 1, 1);
		this._jsNode.onaudioprocess = this._processBuffer.bind(this);

		/** @type {boolean} */
		this.loop = false;

		/**
		 *  @type {TransportState}
		 */
		this.state = TransportState.STOPPED;

		//so it doesn't get garbage collected
		this._jsNode.noGC();
	};

	Tone.extend(Tone.Transport);

	/** 
	 * @private 
	 * @type {number} 
	 */
	var transportTicks = 0;
	/** 
	 * @private
	 * @type {number}
	 */
	var tatum = 12;
	/** 
	 * @private
	 * @type {Boolean}
	 */
	var upTick = false;
	/** 
	 * @private
	 * @type {number}
	 */
	var transportTimeSignature = 4;

	/** 
	 * @private
	 * @type {number}
	 */
	var loopStart = 0;
	/** 
	 * @private
	 * @type {number}
	 */
	var loopEnd = tatum * 4;

	/** 
	 * @private
	 * @type {Array}
	 */
	var intervals = [];
	
	/** 
	 * @private
	 * @type {Array}
	 */
	var timeouts = [];
	
	/** 
	 * @private
	 * @type {Array}
	 */
	var transportTimeline = [];
	
	/** 
	 * @private
	 * @type {number}
	 */
	var timelineProgress = 0;

	/**
	 *  The main oscillator for the system
	 *  @private
	 *  @type {OscillatorNode}
	 */
	var oscillator = null;

	/** 
	 *  controls the oscillator frequency
	 *  starts at 120bpm
	 *  
	 *  @private
	 *  @type {Tone.Signal}
	 */
	var controlSignal = new Tone.Signal(120);

	/** 
	 *  All of the synced components
	 *  @private 
	 *  @type {Array<Tone>}
	 */
	var SyncedComponents = [];


	/**
	 *  @enum
	 */
	 var TransportState = {
	 	STARTED : "started",
	 	PAUSED : "paused",
	 	STOPPED : "stopped"
	 };


	///////////////////////////////////////////////////////////////////////////////
	//	JS NODE PROCESSING
	///////////////////////////////////////////////////////////////////////////////

	/**
	 *  called when a buffer is ready
	 *  	
	 *  @param  {AudioProcessingEvent} event
	 */
	Tone.Transport.prototype._processBuffer = function(event){
		var now = this.defaultArg(event.playbackTime, this.now());
		var bufferSize = this._jsNode.bufferSize;
		var incomingBuffer = event.inputBuffer.getChannelData(0);
		for (var i = 0; i < bufferSize; i++){
			var sample = incomingBuffer[i];
			if (sample > 0 && !upTick){
				upTick = true;	
				this._processTick(now + this.samplesToSeconds(i), i);
			} else if (sample < 0 && upTick){
				upTick = false;
			}
		}
	};

	//@param {number} tickTime
	Tone.Transport.prototype._processTick = function(tickTime, i){
		if (oscillator !== null){
			transportTicks += 1;
			processIntervals(tickTime);
			processTimeouts(tickTime, i);
			processTimeline(tickTime);
			if (this.loop){
				if (transportTicks === loopEnd){
					this._setTicks(this.loopEnd);
				}
			}
		}
	};

	//jump to a specific tick in the timeline
	Tone.Transport.prototype._setTicks = function(ticks){
		transportTicks = ticks;
		for (var i = 0; i < transportTimeline.length; i++){
			var timeout = transportTimeline[i];
			if (timeout.callbackTick() >= ticks){
				timelineProgress = i;
				break;
			}
		}
	};

	///////////////////////////////////////////////////////////////////////////////
	//	EVENT PROCESSING
	///////////////////////////////////////////////////////////////////////////////

	/**
	 *  process the intervals
	 *  @param  {number} time 
	 */
	var processIntervals = function(time){
		for (var i = 0, len = intervals.length; i<len; i++){
			var interval = intervals[i];
			if (interval.testInterval(transportTicks)){
				interval.doCallback(time);
			}
		}
	};

	/**
	 *  process the timeouts
	 *  @param  {number} time 
	 */
	var processTimeouts = function(time){
		var removeTimeouts = 0;
		for (var i = 0, len = timeouts.length; i<len; i++){
			var timeout = timeouts[i];
			var callbackTick = timeout.callbackTick();
			if (callbackTick <= transportTicks){
				timeout.doCallback(time);
				removeTimeouts++;
			} else if (callbackTick > transportTicks){
				break;
			} 
		}
		//remove the timeouts off the front of the array after they've been called
		timeouts.splice(0, removeTimeouts);
	};

	/**
	 *  process the transportTimeline events
	 *  @param  {number} time 
	 */
	var processTimeline = function(time){
		for (var i = timelineProgress, len = transportTimeline.length; i<len; i++){
			var evnt = transportTimeline[i];
			var callbackTick = evnt.callbackTick();
			if (callbackTick === transportTicks){
				evnt.doCallback(time);
				timelineProgress = i;
			} else if (callbackTick > transportTicks){
				break;
			} 
		}
	};

	/**
	 *  clear the timeouts and intervals
	 */
	function clearTimelineEvents(){
		
		intervals = [];
	}

	///////////////////////////////////////////////////////////////////////////////
	//	INTERVAL
	///////////////////////////////////////////////////////////////////////////////

	/**
	 *  intervals are recurring events 
	 *  
	 *  @param {function} callback
	 *  @param {Tone.Time}   interval 
	 *  @param {Object}   ctx  the context the function is invoked in
	 *  @return {number} the id of the interval
	 */
	Tone.Transport.prototype.setInterval = function(callback, interval, ctx){
		var tickTime = this.toTicks(interval);
		var timeout = new TimelineEvent(callback, ctx, tickTime, transportTicks);
		intervals.push(timeout);
		return timeout.id;
	};

	/**
	 *  clear an interval from the processing array
	 *  @param  {number} rmInterval 	the interval to remove
	 *  @return {boolean}            	true if the event was removed
	 */
	Tone.Transport.prototype.clearInterval = function(rmInterval){
		for (var i = 0; i < intervals.length; i++){
			var interval = intervals[i];
			if (interval.id === rmInterval){
				intervals.splice(i, 1);
				return true;
			}
		}
		return false;
	};

	/**
	 *  removes all of the intervals that are currently set
	 */
	Tone.Transport.prototype.clearIntervals = function(){
		intervals = [];
	};

	///////////////////////////////////////////////////////////////////////////////
	//	TIMEOUT
	///////////////////////////////////////////////////////////////////////////////

	/**
	 *  set a timeout to occur after time from now
	 *  
	 *  @param {function} callback 
	 *  @param {Tone.Time}   time     
	 *  @param {Object}   ctx      the context to invoke the callback in
	 *  @return {number} the id of the timeout for clearing timeouts
	 */
	Tone.Transport.prototype.setTimeout = function(callback, time, ctx){
		var ticks = this.toTicks(time);
		var timeout = new TimelineEvent(callback, ctx, ticks + transportTicks, 0);
		//put it in the right spot
		for (var i = 0, len = timeouts.length; i<len; i++){
			var testEvnt = timeouts[i];
			if (testEvnt.callbackTick() > timeout.callbackTick()){
				timeouts.splice(i, 0, timeout);
				return timeout.id;
			}
		}
		//otherwise push it on the end
		timeouts.push(timeout);
		return timeout.id;
	};

	/**
	 *  clear the timeout based on it's ID
	 *  @param  {number} timeoutID 
	 *  @return {boolean}           true if the timeout was removed
	 */
	Tone.Transport.prototype.clearTimeout = function(timeoutID){
		for (var i = 0; i < timeouts.length; i++){
			var testTimeout = timeouts[i];
			if (testTimeout.id === timeoutID){
				timeouts.splice(i, 1);
				return true;
			}
		}
		return false;
	};

	/**
	 *  removes all of the timeouts that are currently set
	 *
	 *  @todo (optionally) remove events after a certain time
	 */
	Tone.Transport.prototype.clearTimeouts = function(){
		timeouts = [];
	};

	///////////////////////////////////////////////////////////////////////////////
	//	TIMELINE
	///////////////////////////////////////////////////////////////////////////////

	/**
	 *  Timeline events are synced to the transportTimeline of the Transport
	 *  Unlike Timeout, Timeline events will restart after the 
	 *  Transport has been stopped and restarted. 
	 *
	 *  
	 *  @param {function} 	callback 	
	 *  @param {Tome.Time}  timeout  
	 *  @param {Object}   	ctx      	the context in which the funtion is called
	 *  @return {number} 				the id for clearing the transportTimeline event
	 */
	Tone.Transport.prototype.setTimeline = function(callback, timeout, ctx){
		var ticks = this.toTicks(timeout);
		var timelineEvnt = new TimelineEvent(callback, ctx, ticks + transportTicks, 0);
		//put it in the right spot
		for (var i = timelineProgress, len = transportTimeline.length; i<len; i++){
			var testEvnt = transportTimeline[i];
			if (testEvnt.callbackTick() > timelineEvnt.callbackTick()){
				transportTimeline.splice(i, 0, timelineEvnt);
				return timelineEvnt.id;
			}
		}
		//otherwise push it on the end
		transportTimeline.push(timelineEvnt);
		return timelineEvnt.id;
	};

	/**
	 *  clear the transportTimeline event from the 
	 *  @param  {number} timelineID 
	 *  @return {boolean} true if it was removed
	 */
	Tone.Transport.prototype.clearTimeline = function(timelineID){
		for (var i = 0; i < transportTimeline.length; i++){
			var testTimeline = transportTimeline[i];
			if (testTimeline.id === timelineID){
				transportTimeline.splice(i, 1);
				return true;
			}
		}
		return false;
	};

	/**
	 *  remove all events from the timeline
	 */
	Tone.Transport.prototype.clearTimelines = function(){
		timelineProgress = 0;
		transportTimeline = [];
	};

	///////////////////////////////////////////////////////////////////////////////
	//	TIME CONVERSIONS
	///////////////////////////////////////////////////////////////////////////////

	/**
	 *  turns the time into
	 *  @param  {Tone.Time} time
	 *  @return {number}      
	 */
	Tone.Transport.prototype.toTicks = function(time){
		//get the seconds
		var seconds = this.toSeconds(time);
		var quarter = this.notationToSeconds("4n");
		var quarters = seconds / quarter;
		var tickNum = quarters * tatum;
		//quantize to tick value
		return Math.round(tickNum);
	};

	/**
	 *  get the transport time
	 *  @return {string} in transportTime format (measures:beats:sixteenths)
	 */
	Tone.Transport.prototype.getTransportTime = function(){
		var quarters = transportTicks / tatum;
		var measures = Math.floor(quarters / transportTimeSignature);
		var sixteenths = Math.floor((quarters % 1) * 4);
		quarters = Math.floor(quarters) % transportTimeSignature;
		var progress = [measures, quarters, sixteenths];
		return progress.join(":");
	};

	/**
	 *  set the transport time, jump to the position right away
	 *  	
	 *  @param {Tone.Time} progress 
	 */
	Tone.Transport.prototype.setTransportTime = function(progress){
		var ticks = this.toTicks(progress);
		this._setTicks(ticks);
	};

	///////////////////////////////////////////////////////////////////////////////
	//	START/STOP/PAUSE
	///////////////////////////////////////////////////////////////////////////////

	/**
	 *  start the transport and all sources synced to the transport
	 *  
	 *  @param  {Tone.Time} time
	 */
	Tone.Transport.prototype.start = function(time){
		if (this.state === TransportState.STOPPED || this.state === TransportState.PAUSED){
			this.state = TransportState.STARTED;
			//reset the oscillator
			oscillator = this.context.createOscillator();
			oscillator.type = "square";
			oscillator.connect(this._jsNode);
			//connect it up
			controlSignal.connect(oscillator.frequency);
			oscillator.frequency.value = 0;
			upTick = false;
			oscillator.start(this.toSeconds(time));

			//call start on each of the synced sources
		}
	};


	/**
	 *  stop the transport and all sources synced to the transport
	 *  
	 *  @param  {Tone.Time} time
	 */
	Tone.Transport.prototype.stop = function(time){
		if (this.state === TransportState.STARTED || this.state === TransportState.PAUSED){
			this.state = TransportState.STOPPED;
			oscillator.stop(this.toSeconds(time));
			oscillator = null;
			this._setTicks(0);
			this.clearTimeouts();
			this.clearIntervals();

			//call stop on each of the synced sources
		}
	};

	/**
	 *  pause the transport and all sources synced to the transport
	 *  
	 *  @param  {Tone.Time} time
	 */
	Tone.Transport.prototype.pause = function(time){
		if (this.state === TransportState.STARTED){
			this.state = TransportState.PAUSED;
			oscillator.stop(this.toSeconds(time));
			oscillator = null;
			clearTimelineEvents();
			//call pause on each of the synced sources
		}
	};

	///////////////////////////////////////////////////////////////////////////////
	//	SETTERS/GETTERS
	///////////////////////////////////////////////////////////////////////////////

	/**
	 *  set the BPM
	 *  optionally ramp to the bpm over some time
	 *  @param {number} bpm   
	 *  @param {Tone.Time=} rampTime 
	 */
	Tone.Transport.prototype.setBpm = function(bpm, rampTime){
		//convert the bpm to frequency
		var tatumFreq = this.toFrequency(tatum.toString() + "n", bpm, transportTimeSignature);
		var freqVal = 4 * tatumFreq;
		if (!rampTime){
			controlSignal.cancelScheduledValues(0);
			controlSignal.setValue(freqVal);
		} else {
			controlSignal.exponentialRampToValueNow(freqVal, rampTime);
		}
	};

	/**
	 *  return the current BPM
	 *  
	 *  @return {number} 
	 */
	Tone.Transport.prototype.getBpm = function(){
		//convert the current frequency of the oscillator to bpm
		var freq = controlSignal.getValue();
		return 60 * (freq / tatum);
	};

	/**
	 *  set the time signature
	 *  
	 *  @example
	 *  this.setTimeSignature(4); //for 4/4
	 *  
	 *  @param {number} numerator   
	 *  @param {number=} denominator defaults to 4
	 */
	Tone.Transport.prototype.setTimeSignature = function(numerator, denominator){
		denominator = this.defaultArg(denominator, 4);
		transportTimeSignature = numerator / (denominator / 4);
	};

	/**
	 *  return the time signature as just the numerator
	 *  over 4 is assumed. 
	 *  for example 4/4 would return 4 and 6/8 would return 3
	 *  
	 *  @return {number} 
	 */
	Tone.Transport.prototype.getTimeSignature = function(){
		return transportTimeSignature;
	};

	/**
	 *  set the loop start position
	 *  
	 *  @param {Tone.Time} startPosition
	 */
	Tone.Transport.prototype.setLoopStart = function(startPosition){
		loopStart = this.toTicks(startPosition);
	};

	/**
	 *  set the loop start position
	 *  
	 *  @param {Tone.Time} endPosition
	 */
	Tone.Transport.prototype.setLoopEnd = function(endPosition){
		loopEnd = this.toTicks(endPosition);
	};

	/**
	 *  shorthand loop setting
	 *  @param {Tone.Time} startPosition 
	 *  @param {Tone.Time} endPosition   
	 */
	Tone.Transport.prototype.setLoopPoint = function(startPosition, endPosition){
		this.setLoopStart(startPosition);
		this.setLoopEnd(endPosition);
	};

	///////////////////////////////////////////////////////////////////////////////
	//	SYNCING
	///////////////////////////////////////////////////////////////////////////////
	

	Tone.Transport.prototype.sync = function(source, controlSignal){
		//create a gain node, attach it to the control signal
		// var ratio = new Tone.Multiply();
		// controlSignal.connect(ratio);
		// return ratio;
	};

	/**
	 *  remove the source from the list of Synced Sources
	 *  
	 *  @param  {Tone.Source} source [description]
	 */
	Tone.Transport.prototype.unsync = function(source){
		
	};


	///////////////////////////////////////////////////////////////////////////////
	//	TIMELINE EVENT
	///////////////////////////////////////////////////////////////////////////////

	/**
	 *  @static
	 *  @type {number}
	 */
	var TimelineEventIDCounter = 0;

	/**
	 *  A Timeline event
	 *
	 *  @constructor
	 *  @param {function(number)} callback   
	 *  @param {Object}   context    
	 *  @param {number}   tickTime
 	 *  @param {number}   startTicks
	 */
	var TimelineEvent = function(callback, context, tickTime, startTicks){
		this.startTicks = startTicks;
		this.tickTime = tickTime;
		this.callback = callback;
		this.context = context;
		this.id = TimelineEventIDCounter++;
	};
	
	/**
	 *  invoke the callback in the correct context
	 *  passes in the playback time
	 *  
	 *  @param  {number} playbackTime 
	 */
	TimelineEvent.prototype.doCallback = function(playbackTime){
		this.callback.call(this.context, playbackTime); 
	};

	/**
	 *  get the tick which the callback is supposed to occur on
	 *  
	 *  @return {number} 
	 */
	TimelineEvent.prototype.callbackTick = function(){
		return this.startTicks + this.tickTime;
	};

	/**
	 *  test if the tick occurs on the interval
	 *  
	 *  @param  {number} tick 
	 *  @return {boolean}      
	 */
	TimelineEvent.prototype.testInterval = function(tick){
		return (tick - this.startTicks) % this.tickTime === 0;
	};


	///////////////////////////////////////////////////////////////////////////////
	//	AUGMENT TONE'S PROTOTYPE TO INCLUDE TRANSPORT TIMING
	///////////////////////////////////////////////////////////////////////////////

	/**
	 *  tests if a string is musical notation
	 *  i.e.:
	 *  	4n = quarter note
	 *   	2m = two measures
	 *    	8t = eighth-note triplet
	 *  
	 *  @return {boolean} 
	 */
	Tone.prototype.isNotation = (function(){
		var notationFormat = new RegExp(/[0-9]+[mnt]$/i);
		return function(note){
			return notationFormat.test(note);
		};
	})();

	/**
	 *  tests if a string is transportTime
	 *  i.e. :
	 *  	1:2:0 = 1 measure + two quarter notes + 0 sixteenth notes
	 *  	
	 *  @return {boolean} 
	 */
	Tone.prototype.isTransportTime = (function(){
		var transportTimeFormat = new RegExp(/^\d+(\.\d+)?:\d+(\.\d+)?(:\d+(\.\d+)?)?$/);
		return function(transportTime){
			return transportTimeFormat.test(transportTime);
		};
	})();

	/**
	 *  true if the input is in the format number+hz
	 *  i.e.: 10hz
	 *
	 *  @param {number} freq 
	 *  @return {boolean} 
	 */
	Tone.prototype.isFrequency = (function(){
		var freqFormat = new RegExp(/[0-9]+hz$/i);
		return function(freq){
			return freqFormat.test(freq);
		};
	})();


	/**
	 *  convert notation format strings to seconds
	 *  @param  {string} notation     
	 *  @param {number=} bpm 
	 *  @param {number=} timeSignature 
	 *  @return {number}               
	 */
	Tone.prototype.notationToSeconds = function(notation, bpm, timeSignature){
		bpm = this.defaultArg(bpm, Tone.Transport.getBpm());
		timeSignature = this.defaultArg(timeSignature, transportTimeSignature);
		var beatTime = (60 / bpm);
		var subdivision = parseInt(notation, 10);
		var beats = 0;
		if (subdivision === 0){
			beats = 0;
		}
		var lastLetter = notation.slice(-1);
		if (lastLetter === "t"){
			beats = (4 / subdivision) * 2/3;
		} else if (lastLetter === "n"){
			beats = 4 / subdivision;
		} else if (lastLetter === "m"){
			beats = subdivision * timeSignature;
		} else {
			beats = 0;
		}
		return beatTime * beats;
	};

	/**
	 *  convert transportTime into seconds
	 *  i.e.:
	 *  	4:2:3 == 4 measures + 2 quarters + 3 sixteenths
	 *  
	 *  @param  {string} transportTime 
	 *  @param {number=} bpm 
	 *  @param {number=} timeSignature
	 *  @return {number}               seconds
	 */
	Tone.prototype.transportTimeToSeconds = function(transportTime, bpm, timeSignature){
		bpm = this.defaultArg(bpm, Tone.Transport.getBpm());
		timeSignature = this.defaultArg(timeSignature, transportTimeSignature);
		var measures = 0;
		var quarters = 0;
		var sixteenths = 0;
		var split = transportTime.split(":");
		if (split.length === 2){
			measures = parseFloat(split[0]);
			quarters = parseFloat(split[1]);
		} else if (split.length === 1){
			quarters = parseFloat(split[0]);
		} else if (split.length === 3){
			measures = parseFloat(split[0]);
			quarters = parseFloat(split[1]);
			sixteenths = parseFloat(split[2]);
		}
		var beats = (measures * timeSignature + quarters + sixteenths / 4);
		return beats * this.notationToSeconds("4n");
	};

	/**
	 *  Convert seconds to the closest transportTime in the form 
	 *  	measures:quarters:sixteenths
	 *  	
	 *  @param {Tone.Time} seconds 
	 *  @param {number=} bpm 
	 *  @param {number=} timeSignature
	 *  @return {string}         
	 */
	Tone.prototype.toTransportTime = function(time, bpm, timeSignature){
		var seconds = this.toSeconds(time, bpm, timeSignature);
		bpm = this.defaultArg(bpm, Tone.Transport.getBpm());
		timeSignature = this.defaultArg(timeSignature, transportTimeSignature);
		var quarterTime = this.notationToSeconds("4n");
		var quarters = seconds / quarterTime;
		var measures = Math.floor(quarters / timeSignature);
		var sixteenths = Math.floor((quarters % 1) * 4);
		quarters = Math.floor(quarters) % timeSignature;
		var progress = [measures, quarters, sixteenths];
		return progress.join(":");
	};

	/**
	 *  convert a time to a frequency
	 *  	
	 *  @param  {Tone.Time} time 
	 *  @return {number}      the time in hertz
	 */
	Tone.prototype.toFrequency = function(time, bpm, timeSignature){
		if (this.isFrequency(time)){
			return parseFloat(time);
		} else if (this.isNotation(time) || this.isTransportTime(time)) {
			return this.secondsToFrequency(this.toSeconds(time, bpm, timeSignature));
		} else {
			return time;
		}
	};

	/**
	 *  convert Tone.Time into seconds.
	 *  
	 *  unlike the method which it overrides, this takes into account 
	 *  transporttime and musical notation
	 *  
	 *  @param  {Tone.Time} time       
	 *  @param  {number=} 	bpm 
	 *  @param  {number=} 	timeSignature   
	 *  @return {number} 
	 */
	Tone.prototype.toSeconds = function(time, bpm, timeSignature){
		if (typeof time === "number"){
			return time; //assuming that it's seconds
		} else if (typeof time === "string"){
			var plusTime = 0;
			if(time.charAt(0) === "+") {
				plusTime = this.now();
				time = time.slice(1);				
			} 
			if (this.isNotation(time)){
				time = this.notationToSeconds(time, bpm, timeSignature);
			} else if (this.isTransportTime(time)){
				time = this.transportTimeToSeconds(time, bpm, timeSignature);
			} else if (this.isFrequency(time)){
				time = this.frequencyToSeconds(time, bpm, timeSignature);
			} else {
				time = parseFloat(time);
			}
			return time + plusTime;
		} else {
			return this.now();
		}
	};

	//a single transport object
	Tone.Transport = new Tone.Transport();

	return Tone.Transport;
});

define('Tone/source/Source',["Tone/core/Tone", "Tone/core/Transport"], function(Tone){
	/**
	 *  base class for sources
	 *
	 *  sources have start/stop/pause
	 *
	 *  they also have the ability to be synced to the 
	 *  start/stop/pause of Tone.Transport
	 *
	 *  @constructor
	 *  @extends {Tone}
	 */	
	Tone.Source = function(){
		/**
		 *  unlike most ToneNodes, Sources only have an output and no input
		 *  
		 *  @type {GainNode}
		 */
		this.output = this.context.createGain();

		/**
		 *  @type {Tone.Source.State}
		 */
		this.state = Tone.Source.State.STOPPED;
	};

	Tone.extend(Tone.Source);

	/**
	 *  @abstract
	 *  @param  {Tone.Time} time 
	 */
	Tone.Source.prototype.start = function(){};

	/**
 	 *  @abstract
	 *  @param  {Tone.Time} time 
	 */
	Tone.Source.prototype.stop = function(){};


	/**
 	 *  @abstract
	 *  @param  {Tone.Time} time 
	 */
	Tone.Source.prototype.pause = function(time){
		//if there is no pause, just stop it
		this.stop(time);
	};

	/**
	 *  sync the source to the Transport
	 */
	Tone.Source.prototype.sync = function(){
		if (this.state !== Tone.Source.State.SYNCED){
			this.state = Tone.Source.State.SYNCED;
			Tone.Transport.sync(this);
		}
	};

	/**
	 *  unsync the source to the Transport
	 */
	Tone.Source.prototype.unsync = function(){
		if (this.state === Tone.Source.State.SYNCED){
			Tone.Transport.unsync(this);
		}
	};


	/**
	 *  @param {number} value 
	 *  @param {Tone.Time} time (relative to 'now')
	 */
	Tone.Source.prototype.fadeTo = function(value, time){
		var currentVolume = this.output.gain.value;
		var now = this.now();
		this.output.gain.cancelScheduledValues(now);
		this.output.gain.setValueAtTime(currentVolume, now);
		this.output.gain.linearRampToValueAtTime(value, this.toSeconds(time));
	};

	/**
	 *  @param {number} value 
	 */
	Tone.Source.prototype.setVolume = function(value){
		this.output.gain.value = value;
	};

	/**
	 *  @enum {string}
	 */
	Tone.Source.State = {
		STARTED : "started",
		PAUSED : "paused",
		STOPPED : "stopped",
		SYNCED : "synced"
 	};

	return Tone.Source;
});
define('Tone/source/Oscillator',["Tone/core/Tone", "Tone/core/Transport", "Tone/signal/Signal", "Tone/source/Source"], 
function(Tone){

	/**
	 *  Oscillator
	 *
	 *  Oscilator with start, pause, stop and sync to Transport
	 *
	 *  @constructor
	 *  @extends {Tone.Source}
	 *  @param {number|string=} freq starting frequency
	 *  @param {string=} type type of oscillator (sine|square|triangle|sawtooth)
	 */
	Tone.Oscillator = function(freq, type){
		Tone.Source.call(this);

		/**
		 *  the main oscillator
		 *  @type {OscillatorNode}
		 */
		this.oscillator = this.context.createOscillator();
		/**
		 *  the frequency control signal
		 *  @type {Tone.Signal}
		 */
		this.frequency = new Tone.Signal(this.defaultArg(this.toFrequency(freq), 440));

		/**
		 *  @type {function()}
		 */
		this.onended = function(){};

		//connections
		this.oscillator.connect(this.output);
		//setup
		this.oscillator.type = this.defaultArg(type, "sine");
	};

	Tone.extend(Tone.Oscillator, Tone.Source);

	/**
	 *  start the oscillator
	 *  
	 *  @param  {Tone.Time} time 
	 */
	Tone.Oscillator.prototype.start = function(time){
		if (this.state === Tone.Source.State.STOPPED){
			this.state = Tone.Source.State.STARTED;
			//get previous values
			var type = this.oscillator.type;
			var detune = this.oscillator.frequency.value;
			//new oscillator with previous values
			this.oscillator = this.context.createOscillator();
			this.oscillator.type = type;
			this.oscillator.detune.value = detune;
			//connect the control signal to the oscillator frequency
			this.oscillator.connect(this.output);
			this.frequency.connect(this.oscillator.frequency);
			this.oscillator.frequency.value = 0;
			//start the oscillator
			this.oscillator.start(this.toSeconds(time));
			this.oscillator.onended = this._onended.bind(this);
		}
	};

	/**
	 *  stop the oscillator
	 *  @param  {Tone.Time=} time (optional) timing parameter
	 */
	Tone.Oscillator.prototype.stop = function(time){
		if (this.state === Tone.Source.State.STARTED){
			if (!time){
				this.state = Tone.Source.State.STOPPED;
			}
			this.oscillator.stop(this.toSeconds(time));
		}
	};

	/**
	 *  Sync the oscillator to the transport
	 *
	 *  the current ratio between the oscillator and the Transport BPM
	 *  is fixed and any change to the Transport BPM will change this
	 *  oscillator in that same ratio
	 *
	 *  Transport start/pause/stop will also start/pause/stop the oscillator
	 */
	Tone.Oscillator.prototype.sync = function(){
		if (this.state !== Tone.Source.State.SYNCED){
			this.state = Tone.Source.State.SYNCED;
			Tone.Transport.sync(this);
			Tone.Transport.syncSignal(this.frequency);
		}
	};

	/**
	 *  unsync the oscillator from the Transport
	 */
	Tone.Oscillator.prototype.unsync = function(){
		if (this.state === Tone.Source.State.SYNCED){
			Tone.Transport.unsync(this);
			this.frequency.unsync();
		}
	};

	/**
	 *  exponentially ramp the frequency of the oscillator over the rampTime
	 *  
	 *  @param {Tone.Time}	val
	 *  @param {Tone.Time=} rampTime when the oscillator will arrive at the frequency
	 */
	Tone.Oscillator.prototype.setFrequency = function(val, rampTime){
		if (rampTime){
			this.frequency.exponentialRampToValueAtTime(this.toFrequency(val), this.toSeconds(rampTime));
		} else {
			this.frequency.setValue(this.toFrequency(val));
		}
	};

	/**
	 *  set the oscillator type
	 *  
	 *  @param {string} type (sine|square|triangle|sawtooth)
	 */
	Tone.Oscillator.prototype.setType = function(type){
		this.oscillator.type = type;
	};

	/**
	 *  internal on end call
	 *  @private
	 */
	Tone.Oscillator.prototype._onended = function(){
		this.state = Tone.Source.State.STOPPED;
		this.onended();
	};

	/**
	 *  dispose and disconnect
	 */
	Tone.Oscillator.prototype.dispose = function(){
		if (this.oscillator !== null){
			this.oscillator.disconnect();
			this.oscillator = null;
		}
		this.frequency.dispose();
		this.frequency = null;
		this.output.disconnect();
		this.output = null;
	};

	return Tone.Oscillator;
});
define('Tone/component/LFO',["Tone/core/Tone", "Tone/source/Oscillator", "Tone/signal/Scale"], function(Tone){

	/**
	 *  Low Frequency Oscillator
	 *
	 *  LFO produces an output signal which can be attached to an AudioParam
	 *  	for constant control over that parameter
	 *  	the LFO can also be synced to the transport
	 *
	 *  @constructor
	 *  @extends {Tone}
	 *  @param {number} rate      
	 *  @param {number=} outputMin 
	 *  @param {number=} outputMax
	 */
	Tone.LFO = function(rate, outputMin, outputMax){

		Tone.call(this);

		/** @type {Tone.Oscillator} */
		this.oscillator = new Tone.Oscillator(rate, "sine");
		/** @type {Tone.Scale} */
		this.scaler = new Tone.Scale(this.defaultArg(outputMin, 0), this.defaultArg(outputMax, 1));

		//connect it up
		this.chain(this.oscillator, this.scaler, this.output);
	};

	Tone.extend(Tone.LFO);


	/**
	 *  start the LFO
	 *  @param  {Tone.Time} time 
	 */
	Tone.LFO.prototype.start = function(time){
		this.oscillator.start(time);
	};

	/**
	 *  stop the LFO
	 *  @param  {Tone.Time} time 
	 */
	Tone.LFO.prototype.stop = function(time){
		this.oscillator.stop(time);
	};

	/**
	 *  Sync the start/stop/pause to the transport 
	 *  and the frequency to the bpm of the transport
	 */
	Tone.LFO.prototype.sync = function(){
		this.oscillator.sync();
	};

	/**
	 *  unsync the LFO from transport control
	 */
	Tone.LFO.prototype.unsync = function(){
		this.oscillator.unsync();
	};


	/**
	 *  set the frequency
	 *  @param {number} rate 
	 */
	Tone.LFO.prototype.setFrequency = function(rate){
		this.oscillator.setFrequency(rate);
	};

	/**
	 *  set the minimum output of the LFO
	 *  @param {number} min 
	 */
	Tone.LFO.prototype.setMin = function(min){
		this.scaler.setOutputMin(min);
	};

	/**
	 *  set the maximum output of the LFO
	 *  @param {number} min 
	 */
	Tone.LFO.prototype.setMax = function(max){
		this.scaler.setOuputMax(max);
	};

	/**
	 *  set the waveform of the LFO
	 *  @param {string} type 
	 */
	Tone.LFO.prototype.setType = function(type){
		this.oscillator.setType(type);
	};

	/**
	 *  pointer to the parent's connect method
	 *  @private
	 */
	Tone.LFO.prototype._connect = Tone.prototype.connect;

	/**
	 *	override the connect method so that it 0's out the value 
	 *	if attached to an AudioParam
	 *	
	 *  @override
	 *  @param  {AudioNode|AudioParam|Tone} param 
	 */
	Tone.LFO.prototype.connect = function(param){
		if (param instanceof AudioParam){
			//set the initial value
			param.value = 0;
		} 
		this._connect(param);
	};

	return Tone.LFO;
});
define('Tone/component/Meter',["Tone/core/Tone", "Tone/core/Master"], function(Tone){

	/**
	 *  get the rms of the input signal with some averaging
	 *  can also just get the value of the signal
	 *  or the value in dB
	 *  
	 *  inspired by https://github.com/cwilso/volume-meter/blob/master/volume-meter.js
	 *  The MIT License (MIT) Copyright (c) 2014 Chris Wilson
	 *
	 *  @constructor
	 *  @extends {Tone}
	 *  @param {number=} channels (optional) number of channels being metered
	 *  @param {number=} smoothing (optional) amount of smoothing applied to the volume
	 *  @param {number=} clipMemory (optional) number in ms that a "clip" should be remembered
	 */
	Tone.Meter = function(channels, smoothing, clipMemory){
		//extends Unit
		Tone.call(this);

		/** @type {number} */
		this.channels = this.defaultArg(channels, 1);

		/** @type {number} */
		this.smoothing = this.defaultArg(smoothing, 0.8);

		/** @type {number} */
		this.clipMemory = this.defaultArg(clipMemory, 500);

		/** 
		 *  the rms for each of the channels
		 *  @private
		 *  @type {Array<number>}
		 */
		this._volume = new Array(this.channels);

		/** 
		 *  the raw values for each of the channels
		 *  @private
		 *  @type {Array<number>}
		 */
		this._values = new Array(this.channels);

		//zero out the volume array
		for (var i = 0; i < this.channels; i++){
			this._volume[i] = 0;
			this._values[i] = 0;
		}

		/** 
		 *  last time the values clipped
		 *  @private
		 *  @type {number}
		 */
		this._lastClip = 0;
		
		/** 
		 *  @private
		 *  @type {ScriptProcessorNode}
		 */
		this._jsNode = this.context.createScriptProcessor(this.bufferSize, this.channels, 1);
		this._jsNode.onaudioprocess = this._onprocess.bind(this);
		//so it doesn't get garbage collected
		this._jsNode.noGC();

		//signal just passes
		this.input.connect(this.output);
		this.input.connect(this._jsNode);
	};

	Tone.extend(Tone.Meter);

	/**
	 *  called on each processing frame
	 *  @private
	 *  @param  {AudioProcessingEvent} event 
	 */
	Tone.Meter.prototype._onprocess = function(event){
		var bufferSize = this._jsNode.bufferSize;
		var smoothing = this.smoothing;
		for (var channel = 0; channel < this.channels; channel++){
			var input = event.inputBuffer.getChannelData(channel);
			var sum = 0;
			var total = 0;
			var x;
			var clipped = false;
			for (var i = 0; i < bufferSize; i++){
				x = input[i];
				if (!clipped && x > 0.95){
					clipped = true;
					this._lastClip = Date.now();
				}
				total += x;
		    	sum += x * x;
			}
			var average = total / bufferSize;
			var rms = Math.sqrt(sum / bufferSize);
			this._volume[channel] = Math.max(rms, this._volume[channel] * smoothing);
			this._values[channel] = average;
		}
	};

	/**
	 *  get the rms of the signal
	 *  	
	 *  @param  {number=} channel which channel
	 *  @return {number}         the value
	 */
	Tone.Meter.prototype.getLevel = function(channel){
		channel = this.defaultArg(channel, 0);
		var vol = this._volume[channel];
		if (vol < 0.00001){
			return 0;
		} else {
			return vol;
		}
	};

	/**
	 *  get the value of the signal
	 *  @param  {number=} channel 
	 *  @return {number}         
	 */
	Tone.Meter.prototype.getValue = function(channel){
		channel = this.defaultArg(channel, 0);
		return this._values[channel];
	};

	/**
	 *  get the volume of the signal in dB
	 *  @param  {number=} channel 
	 *  @return {number}         
	 */
	Tone.Meter.prototype.getDb = function(channel){
		return this.gainToDb(this.getLevel(channel));
	};

	// @returns {boolean} if the audio has clipped in the last 500ms
	Tone.Meter.prototype.isClipped = function(){
		return Date.now() - this._lastClip < this.clipMemory;
	};

	/**
	 *  @override
	 */
	Tone.Meter.prototype.dispose = function(){
		this._jsNode.disconnect();
		this._jsNode.onaudioprocess = null;
		this._volume = null;
		this._values = null;
		this.input.disconnect();
		this.output.disconnect();
	};

	return Tone.Meter;
});
define('Tone/signal/Merge',["Tone/core/Tone"], function(Tone){

	/**
	 *  merge a left and a right channel into a single stereo channel
	 *
	 *  instead of connecting to the input, connect to either the left, or right input
	 *
	 *  default input for connect is left input
	 *
	 *  @constructor
	 *  @extends {Tone}
	 */
	Tone.Merge = function(){

		Tone.call(this);

		/**
		 *  the left input channel
		 *  also an alias for the input
		 *  @type {GainNode}
		 */
		this.left = this.input;
		/**
		 *  the right input channel
		 *  @type {GainNode}
		 */
		this.right = this.context.createGain();
		/**
		 *  the merger node for the two channels
		 *  @type {ChannelMergerNode}
		 */
		this.merger = this.context.createChannelMerger(2);

		//connections
		this.left.connect(this.merger, 0, 0);
		this.right.connect(this.merger, 0, 1);
		this.merger.connect(this.output);
	};

	Tone.extend(Tone.Merge);

	/**
	 *  clean up
	 */
	Tone.Merge.prototype.dispose = function(){
		this.input.disconnect();
		this.right.disconnect();
		this.merger.disconnect();
		this.input = null;
		this.right = null;
		this.merger = null;
	}; 

	return Tone.Merge;
});

///////////////////////////////////////////////////////////////////////////////
//
//  PANNER
//
//	Equal Power Gain L/R Panner. Not 3D
//	0 = 100% Left
//	1 = 100% Right
///////////////////////////////////////////////////////////////////////////////

define('Tone/component/Panner',["Tone/core/Tone", "Tone/signal/Merge", "Tone/signal/Signal", "Tone/signal/Scale"], 
function(Tone){

	Tone.Panner = function(){
		Tone.call(this);

		//components
		//incoming signal is sent to left and right
		this.left = this.context.createGain();
		this.right = this.context.createGain();
		this.control = new Tone.Signal();
		this.merge = new Tone.Merge();
		this.invert = new Tone.Scale(1, 0);
		this.normal = new Tone.Scale(0, 1);

		//connections
		this.chain(this.input, this.left, this.merge.left);
		this.chain(this.input, this.right, this.merge.right);
		this.merge.connect(this.output);
		//left channel control
		this.chain(this.control, this.invert, this.left.gain);
		//right channel control
		this.chain(this.control, this.normal, this.right.gain);


		//setup
		this.left.gain.value = 0;
		this.right.gain.value = 0;
		this.setPan(.5);
	};

	Tone.extend(Tone.Panner);

	Tone.Panner.prototype.setPan = function(val, rampTime){
		rampTime = this.defaultArg(rampTime, 0);
		//put val into -1 to 1 range
		this.control.linearRampToValueAtTime(val, rampTime);
	};

	return Tone.Panner;
});;
define('Tone/component/Recorder',["Tone/core/Tone", "Tone/core/Master"], function(Tone){

	/**
	 *  Record an input into an array or AudioBuffer
	 *
	 *  it is limited in that the recording length needs to be known beforehand
	 *
	 *  @constructor
	 *  @extends {Tone}
	 *  @param {number} channels 
	 */
	Tone.Recorder = function(channels){

		Tone.call(this);

		/**
		 *  the number of channels in the recording
		 *  @type {number}
		 */
		this.channels = this.defaultArg(channels, 1);

		/**
		 *  @private
		 *  @type {ScriptProcessorNode}
		 */
		this._jsNode = this.context.createScriptProcessor(this.bufferSize, this.channels, 1);
		this._jsNode.onaudioprocess = this._audioprocess.bind(this);

		/**
		 *  Float32Array for each channel
		 *  @private
		 *  @type {Array<Float32Array>}
		 */
		this._recordBuffers = new Array(this.channels);

		/** 
		 *  @private
		 *  @type {number}
		 */
		this._recordBufferOffset = 0;

		//connect it up
		this.input.connect(this._jsNode);
		//pass thru audio
		this.input.connect(this.output);
		//so it doesn't get garbage collected
		this._jsNode.noGC();
		//clear it to start
		this.clear();
	};

	Tone.extend(Tone.Recorder);

	/**
	 *  internal method called on audio process
	 *  
	 *  @private
	 *  @param   {AudioProcessorEvent} event 
	 */
	Tone.Recorder.prototype._audioprocess = function(event){
		if (this._recordBuffers[0] === null || this._recordBuffers[0].length - this._recordBufferOffset === 0){
			return;
		}
		var input = event.inputBuffer;
		var totalWrittenToBuffer = 0;
		var recordBufferLength = this._recordBuffers[0].length;
		for (var channelNum = 0; channelNum < input.numberOfChannels; channelNum++){
			var bufferOffset = this._recordBufferOffset;
			var channel = input.getChannelData(channelNum);
			var bufferLen = channel.length;
			if (recordBufferLength - bufferOffset > bufferLen){
				this._recordBuffers[channelNum].set(channel, bufferOffset);
				totalWrittenToBuffer += bufferLen;
			} else {
				for (var i = 0; i < bufferLen; i++) {
					if (recordBufferLength > bufferOffset){
						this._recordBuffers[channelNum][bufferOffset] = channel[i];
						bufferOffset++;
						totalWrittenToBuffer++;
					} else {
						break;
					}
				}
			}
		}
		this._recordBufferOffset += totalWrittenToBuffer / input.numberOfChannels;
	};

	/**
	 *  Record for a certain period of time
	 *  
	 *  will clear the internal buffer before starting
	 *  
	 *  @param  {Tone.Time} time 
	 */
	Tone.Recorder.prototype.record = function(time){
		this.clear();
		var recordBufferLength = this.toSamples(time);
		for (var i = 0; i < this.channels; i++){
			this._recordBuffers[i] = new Float32Array(recordBufferLength);
		}
	};

	/**
	 *  clears the recording buffer
	 */
	Tone.Recorder.prototype.clear = function(){
		for (var i = 0; i < this.channels; i++){
			this._recordBuffers[i] = null;
		}
		this._recordBufferOffset = 0;
	};


	/**
	 *  true if there is nothing in the buffers
	 *  @return {boolean} 
	 */
	Tone.Recorder.prototype.isEmpty = function(){
		return this._recordBuffers[0] === null;
	};

	/**
	 *  @return {Array<Float32Array>}
	 */
	Tone.Recorder.prototype.getFloat32Array = function(){
		if (this.isEmpty()){
			return null;
		} else {
			return this._recordBuffers;
		}
	};

	/**
	 *  @return {AudioBuffer}
	 */
	Tone.Recorder.prototype.getAudioBuffer = function(){
		if (this.isEmpty()){
			return null;
		} else {
			var audioBuffer = this.context.createBuffer(this.channels, this._recordBuffers[0].length, this.context.sampleRate);
			for (var channelNum = 0; channelNum < audioBuffer.numberOfChannels; channelNum++){
				var channel = audioBuffer.getChannelData(channelNum);
				channel.set(this._recordBuffers[channelNum]);
			}
			return audioBuffer;
		}
	};


	return Tone.Recorder;
});
define('Tone/core/Bus',["Tone/core/Tone"], function(Tone){

	/**
	 *  buses are another way of routing audio
	 *
	 *  augments Tone.prototype to include send and recieve
	 */

	 /**
	  *  All of the routes
	  *  
	  *  @type {Object}
	  */
	var Buses = {};

	/**
	 *  send signal to a channel name
	 *
	 *  @param  {string} channelName 
	 *  @param  {number} amount      
	 *  @return {GainNode}             
	 */
	Tone.prototype.send = function(channelName, amount){
		if (!Buses.hasOwnProperty(channelName)){
			Buses[channelName] = this.context.createGain();
		}
		var sendKnob = this.context.createGain();
		sendKnob.gain.value = this.defaultArg(amount, 1);
		this.chain(this.output, sendKnob, Buses[channelName]);
		return sendKnob;		
	};

	/**
	 *  recieve the input from the desired channelName to the input gain of 'this' node.
	 *
	 *  @param  {string} channelName 
	 */
	Tone.prototype.receive = function(channelName){
		if (!Buses.hasOwnProperty(channelName)){
			Buses[channelName] = this.context.createGain();	
		}
		Buses[channelName].connect(this.input);
	};

	Tone.Buses = Buses;

	return Buses;
});
///////////////////////////////////////////////////////////////////////////////
//
//  EFFECTS UNIT
//
// 	connect the effect to the effectSend and to the effectReturn
//	setDry(-1) = 100% Wet
//	setDry(1) = 100% Dry
///////////////////////////////////////////////////////////////////////////////

define('Tone/effects/Effect',["Tone/core/Tone", "Tone/component/DryWet"], function(Tone){

	Tone.Effect = function(){
		//extends Unit
		Tone.call(this);

		//components
		this.dryWet = new Tone.DryWet();
		this.effectSend = this.context.createGain();
		this.effectReturn = this.context.createGain();

		//connections
		this.input.connect(this.dryWet.dry);
		this.input.connect(this.effectSend);
		this.effectReturn.connect(this.dryWet.wet);
		this.dryWet.connect(this.output);
		
		//setup
		this.setDry(0);
	}

	Tone.extend(Tone.Effect, Tone);

	//adjust the dry/wet balance
	//dryness -1 to 1
	// 1 = 100% dry
	//-1 = 100% wet
	//@param {number} dryness
	//@param {number=} rampTime
	Tone.Effect.prototype.setDry = function(dryness, rampTime){
		this.dryWet.setDry(dryness, rampTime)
	}

	//@param {number} dryness
	//@param {number=} rampTime
	Tone.Effect.prototype.setWet = function(wetVal, rampTime){
		this.setDry(-wetVal, rampTime);
	}

	Tone.Effect.prototype.bypass = function(){
		this.setDry(1, 0);
	}

	Tone.Effect.prototype.connectEffect = function(effect){
		this.chain(this.effectSend, effect, this.effectReturn);
	}

	return Tone.Effect;
});
define('Tone/effects/AutoPanner',["Tone/core/Tone", "Tone/source/Oscillator", "Tone/component/Panner", "Tone/effects/Effect"], function(Tone){

	/**
	* AutoPanner creates a left-right panner effect (not a 3D panner).
	*
	* @constructor
	* @param { number= } rate (optional) rate in HZ of the left-right pan
	* @param { number= } amount (optional) of the pan in dB (0 - 1)
	*/
	Tone.AutoPanner = function(rate, amount){
		Tone.Effect.call(this);

		//defaults
		amount = this.defaultArg(amount, 1);
		rate = this.defaultArg(rate, 1);

		//components
		this.osc = new Tone.Oscillator(rate);
		this.amount = this.context.createGain();
		this.panner = new Tone.Panner();

		//connections
		this.connectEffect(this.panner);
		this.chain(this.osc, this.amount, this.panner.control);
	};

	//extend Effect
	Tone.extend(Tone.AutoPanner, Tone.Effect);
	
	/**
	 * Start the panner
	 * 
	 * @param {Tone.Time} Time the panner begins.
	 */
	Tone.AutoPanner.prototype.start = function(time){
		this.osc.start(time);
	};

	/**
	 * Stop the panner
	 * 
	 * @param {Tone.Time} time the panner stops.
	 */
	Tone.AutoPanner.prototype.stop = function(time){
		this.osc.stop(time);
	};

	/**
	 * Set the type of oscillator attached to the AutoPanner.
	 * 
	 * @param {string} type of oscillator the panner is attached to (sine|sawtooth|triangle|square)
	 */
	Tone.AutoPanner.prototype.setType = function(type){
		this.osc.setType(type);
	};

	/**
	 * Set frequency of the oscillator attached to the AutoPanner.
	 * 
	 * @param {number|string} rate in HZ of the oscillator's frequency.
	 */
	Tone.AutoPanner.prototype.setFrequency = function(rate){
		this.osc.setFrequency(rate);
	};

	/**
	 * Set the amount of the AutoPanner.
	 * 
	 * @param {number} amount in dB (0 - 1)
	 */
	Tone.AutoPanner.prototype.setAmount = function(amount){
		this.amount.gain.value = amount;
	};

	return Tone.AutoPanner;
});

///////////////////////////////////////////////////////////////////////////////
//
//  FEEDBACK EFFECTS
//
// 	an effect with feedback
///////////////////////////////////////////////////////////////////////////////

define('Tone/effects/FeedbackEffect',["Tone/core/Tone", "Tone/effects/Effect"], function(Tone){

	Tone.FeedbackEffect = function(){
		//extends Unit
		Tone.Effect.call(this);

		this.feedback = this.context.createGain();
		//feedback loop
		this.chain(this.effectReturn, this.feedback, this.effectSend);

		//some initial values
		this.setFeedback(0);
	}

	Tone.extend(Tone.FeedbackEffect, Tone.Effect);

	Tone.FeedbackEffect.prototype.setFeedback = function(fback){
		this.rampToValueNow(this.feedback.gain, fback);
	}

	return Tone.FeedbackEffect;
});

///////////////////////////////////////////////////////////////////////////////
//
//	FEEDBACK DELAY
//
///////////////////////////////////////////////////////////////////////////////

define('Tone/effects/FeedbackDelay',["Tone/core/Tone", "Tone/effects/FeedbackEffect"], function(Tone){

	//@param {number} delayTime
	Tone.FeedbackDelay = function(delayTime){
		Tone.FeedbackEffect.call(this);

		this.delay = this.context.createDelay(4);
		this.delay.delayTime.value = this.toSeconds(this.defaultArg(delayTime, .25));

		//connect it up
		this.connectEffect(this.delay);
	}

	Tone.extend(Tone.FeedbackDelay, Tone.FeedbackEffect);

	/**
	 *  sets the delay time
	 *  @param {Tone.Time} time 
	 */
	Tone.FeedbackDelay.prototype.setDelayTime = function(time){
		this.rampToValueNow(this.delay.delayTime, this.toSeconds(time));
	}

	return Tone.FeedbackDelay;
});
///////////////////////////////////////////////////////////////////////////////
//
//	PING PONG DELAY
//
///////////////////////////////////////////////////////////////////////////////

define('Tone/effects/PingPongDelay',["Tone/core/Tone", "Tone/effects/FeedbackDelay"], function(Tone){


	//@param {number=} delayTime
	Tone.PingPongDelay = function(delayTime){
		Tone.StereoSplit.call(this);

		//components
		this.leftDelay = new Tone.FeedbackDelay(delayTime);
		this.rightDelay = new Tone.FeedbackDelay(delayTime);


		//connect it up
		this.connectLeft(this.leftDelay);
		this.connectRight(this.rightDelay);

		//disconnect the feedback lines to connect them to the other delay
		// http://jvzaudio.files.wordpress.com/2011/04/delay-f43.gif
		this.leftDelay.feedback.disconnect();
		this.rightDelay.feedback.disconnect();
		this.leftDelay.feedback.connect(this.rightDelay.effectSend);
		this.rightDelay.feedback.connect(this.leftDelay.effectSend);

		//initial vals;
		this.setDelayTime(delayTime);
	}

	Tone.extend(Tone.PingPongDelay, Tone.StereoSplit);

	//@param {number} delayTime
	Tone.PingPongDelay.prototype.setDelayTime = function(delayTime){
		this.leftDelay.setDelayTime(delayTime);
		this.rightDelay.setDelayTime(delayTime * 2);
	}

	//@param {number} feedback (0 - 1)
	Tone.PingPongDelay.prototype.setFeedback = function(feedback){
		this.leftDelay.setFeedback(feedback);
		this.rightDelay.setFeedback(feedback);
	}

	//@param {number} wet (0 - 1)
	Tone.PingPongDelay.prototype.setWet = function(wet){
		this.leftDelay.setWet(wet);
		this.rightDelay.setWet(wet);
	}

	//@param {number} dry (0 - 1)
	Tone.PingPongDelay.prototype.setDry = function(dry){
		this.leftDelay.setDry(dry);
		this.rightDelay.setDry(dry);
	}

	return Tone.PingPongDelay;
});

define('Tone/instrument/MonoSynth',["Tone/core/Tone", "Tone/component/Envelope", "Tone/source/Oscillator"], function(Tone){


	Tone.MonoSynth = function(){
		//one oscillator
		this.oscillator = this.context.createOscillator();
		this.glideTime = .01;
		this.filterEnvelope = new Tone.Envelope();
	}

	return Tone.MonoSynth;
});
define('Tone/source/Player',["Tone/core/Tone", "Tone/source/Source"], function(Tone){
	
	/**
	 *  Audio Player
	 *  
	 *  Audio file player with start, loop, stop.
	 *  
	 *  @constructor
	 *  @extends {Tone.Source} 
	 *  @param {string} url
	 */
	Tone.Player = function(url){
		Tone.Source.call(this);

		/**
		 *  the url to load
		 *  @type {string}
		 */
		this.url = url;
		/**
		 *  @private
		 *  @type {AudioBufferSourceNode}
		 */
		this._source = null;
		
		/**
		 *  the buffer
		 *  @private
		 *  @type {AudioBuffer}
		 */
		this._buffer = null;


		/**
		 *  the duration of the buffer once it's been loaded
		 *  @type {number}
		 */
		this.duration = 0;

		/**
		 *  the playback rate
		 *  @private
		 *  @type {number}
		 */
		this._playbackRate = 1;

		/**
		 *  enabling retrigger will allow a player to be restarted
		 *  before the it's is done playing
		 *  
		 *  @type {boolean}
		 */
		this.retrigger = false;

		/**
		 *  set a callback function to invoke when the sample is over
		 *  
		 *  @type {function}
		 */
		this.onended = function(){};
	};

	Tone.extend(Tone.Player, Tone.Source);

	/**
	 *  makes an xhr reqest for the selected url
	 *  Load the audio file as an audio buffer.
	 *  Decodes the audio asynchronously and invokes
	 *  the callback once the audio buffer loads.
	 *  
	 *  @param {function(Tone.Player)} callback
	 */
	Tone.Player.prototype.load = function(callback){
		if (!this._buffer){
			var request = new XMLHttpRequest();
			request.open("GET", this.url, true);
			request.responseType = "arraybuffer";
			// decode asynchronously
			var self = this;
			request.onload = function() {
				self.context.decodeAudioData(request.response, function(buff) {
					self._buffer = buff;
					self.duration = buff.duration;
					if (callback){
						callback(self);
					}
				});
			};
			//send the request
			request.send();
		} else {
			if (callback){
				callback(this);
			}
		}
	};

	/**
	 *  play the buffer between the desired positions
	 *  	
	 *  @param  {Tone.Time=} startTime 
	 *  @param  {Tone.Time=} offset    
	 *  @param  {Tone.Time=} duration
	 */
	Tone.Player.prototype.start = function(startTime, offset, duration){
		if (this.state === Tone.Source.State.STOPPED || this.retrigger){
			if (this._buffer){
				this.state = Tone.Source.State.STARTED;
				//default args
				offset = this.defaultArg(offset, 0);
				duration = this.defaultArg(duration, this._buffer.duration - offset);
				//make the source
				this._source = this.context.createBufferSource();
				this._source.buffer = this._buffer;
				this._source.loop = false;
				this._source.playbackRate.value = this._playbackRate;
				this._source.start(this.toSeconds(startTime), this.toSeconds(offset), this.toSeconds(duration));
				this._source.onended = this._onended.bind(this);
				this.chain(this._source, this.output);
			}
		}
	};

	/**
	 *  Loop the buffer from start to finish at a time
	 *
	 *  @param  {Tone.Time=} startTime
	 *  @param  {Tone.Time=} loopStart
	 *  @param  {Tone.Time=} loopEnd
	 *  @param  {Tone.Time=} offset
	 *  @param  {Tone.Time=} duration
	 */
	Tone.Player.prototype.loop = function(startTime, loopStart, loopEnd, offset, duration){
		if (this._buffer){
			//default args
			loopStart = this.defaultArg(loopStart, 0);
			loopEnd = this.defaultArg(loopEnd, this._buffer.duration);
			offset = this.defaultArg(offset, loopStart);
			duration = this.defaultArg(duration, this._buffer.duration - offset);
			//make/play the source
			this.start(startTime, offset, duration);
			this._source.loop = true;
			this._source.loopStart = this.toSeconds(loopStart);
			this._source.loopEnd = this.toSeconds(loopEnd);
		}
	};

	/**
	 *  Stop playback.
	 * 
	 *  @param  {Tone.Time} time
	 */
	Tone.Player.prototype.stop = function(time){
		if (this.state === Tone.Source.State.STARTED) {
			if (this._buffer && this._source){
				if (!time){
					this.state = Tone.Source.State.STOPPED;
				}
				this._source.stop(this.toSeconds(time));
			}
		}
	};

	/**
	 *  set the rate at which the file plays
	 *  
	 *  @param {number} rate
	 *  @param {Tone.Time=} rampTime (optional) the amount of time it takes to 
	 *                               reach the rate
	 */
	Tone.Player.prototype.setPlaybackRate = function(rate, rampTime){
		this._playbackRate = rate;
		if (this._source) {
			if (rampTime){
				this._source.playbackRate.exponentialRampToValueAtTime(rate, this.toSeconds(rampTime));
			} else {
				this._source.playbackRate.value = rampTime;
			}
		} 
	};

	/**
	 *  internal call when the buffer is done playing
	 *  
	 *  @private
	 */
	Tone.Player.prototype._onended = function(){
		this.state = Tone.Source.State.STOPPED;
		this.onended();
	};

	/**
	 *  dispose and disconnect
	 */
	Tone.Player.prototype.dispose = function(){
		if (this._source !== null){
			this._source.disconnect();
			this._source = null;
		}
		this._buffer = null;
		this.output.disconnect();
		this.output = null;
	};

	return Tone.Player;
});

///////////////////////////////////////////////////////////////////////////////
//
//  SAMPLE PLAYER
//
//	dependencies : Tone, Player, Envelope, LFO
///////////////////////////////////////////////////////////////////////////////

define('Tone/instrument/Sampler',["Tone/core/Tone", "Tone/component/Envelope", "Tone/source/Player"], function(Tone){

	Tone.Sampler = function(url){
		Tone.call(this);

		//components
		this.player = new Tone.Player(url);
		this.envelope = new Tone.Envelope(.1, .01, .1, 1);
		this.filter = this.context.createBiquadFilter();
		this.filter.type = "lowpass";
		this.filter.Q.value = 12;
		this.filterEnvelope = new Tone.Envelope(.4, 0, 1, .6, this.filter.frequency, 0, 1200);

		//connect it up
		this.chain(this.player, this.envelope, this.filter, this.output);
	}

	Tone.extend(Tone.Sampler, Tone);


	//@param {function()=} callback
	Tone.Sampler.prototype.load = function(callback){
		this.player.load(callback);
	}

	Tone.Sampler.prototype.triggerAttack = function(startTime){
		this.player.start(startTime);
		this.envelope.triggerAttack(startTime);
		this.filterEnvelope.triggerAttack(startTime);
	}

	Tone.Sampler.prototype.triggerRelease = function(stopTime){
		stopTime = this.defaultArg(stopTime, this.now());
		this.player.stop(stopTime + Math.max(this.envelope.release, this.filterEnvelope.release));
		this.envelope.triggerRelease(stopTime);
		this.filterEnvelope.triggerRelease(stopTime);
	}

	return Tone.Sampler;
});
define('Tone/signal/BitCrusher',["Tone/core/Tone"], function(Tone){

	/**
	 *  downsample incoming signal
	 *  inspiration from https://github.com/jaz303/bitcrusher/blob/master/index.js
	 *
	 *  @constructor
	 *  @extends {Tone}
	 *  @param {number=} bits   
	 *  @param {number=} frequency 
	 */
	Tone.BitCrusher = function(bits, frequency){

		Tone.call(this);

		/** 
		 * @private 
		 * @type {number}
		 */
		this._bits = this.defaultArg(bits, 8);
		
		/** 
		 * @private 
		 * @type {number}
		 */
		this._frequency = this.defaultArg(frequency, 0.5);
		
		/** 
		 * @private 
		 * @type {number}
		 */
		this._step = 2 * Math.pow(0.5, this._bits);
		
		/** 
		 * @private 
		 * @type {number}
		 */
		this._invStep = 1/this._step;
		
		/** 
		 * @private 
		 * @type {number}
		 */
		this._phasor = 0;
		
		/** 
		 * @private 
		 * @type {number}
		 */
		this._last = 0;
		
		/** 
		 * @private 
		 * @type {ScriptProcessorNode}
		 */
		this._crusher = this.context.createScriptProcessor(this.bufferSize, 1, 1);
		this._crusher.onaudioprocess = this._audioprocess.bind(this);

		//connect it up
		this.chain(this.input, this._crusher, this.output);
	};

	Tone.extend(Tone.BitCrusher);

	/**
	 *  @private
	 *  @param  {AudioProcessingEvent} event
	 */
	Tone.BitCrusher.prototype._audioprocess = function(event){
		//cache the values used in the loop
		var phasor = this._phasor;
		var freq = this._frequency;
		var invStep = this._invStep;
		var last = this._last;
		var step = this._step;
		var input = event.inputBuffer.getChannelData(0);
		var output = event.outputBuffer.getChannelData(0);
		for (var i = 0, len = output.length; i < len; i++) {
			phasor += freq;
		    if (phasor >= 1) {
		        phasor -= 1;
		        last = step * ((input[i] * invStep) | 0 + 0.5);
		    }
		    output[i] = last;
		}
		//set the values for the next loop
		this._phasor = phasor;
		this._last = last;
	};

	/**
	 *  set the bit rate
	 *  
	 *  @param {number} bits 
	 */
	Tone.BitCrusher.prototype.setBits = function(bits){
		this._bits = bits;
		this._step = 2 * Math.pow(0.5, this._bits);
		this._invStep = 1/this._step;
	};

	/**
	 *  set the frequency
	 *  @param {number} freq 
	 */
	Tone.BitCrusher.prototype.setFrequency = function(freq){
		this._frequency = freq;
	};

	/**
	 *  clean up
	 */
	Tone.BitCrusher.prototype.dispose = function(){
		this.input.disconnect();
		this.output.disconnect();
		this._crusher.disconnect();
		this.input = null;
		this.output = null;
		this._crusher = null;
	}; 

	return Tone.BitCrusher;
});
define('Tone/signal/Split',["Tone/core/Tone"], function(Tone){

	/**
	 *	split the incoming signal into left and right channels
	 *
	 *  the left channel is the default output
	 *  
	 *  @constructor
	 *  @extends {Tone}
	 */
	Tone.Split = function(){
		Tone.call(this);

		/** @type {ChannelSplitterNode} */
		this.splitter = this.context.createChannelSplitter(2);
		/** 
		 *  left channel output
		 *  @alias for the default output
		 *  @type {GainNode}
		 */
		this.left = this.output;
		/**
		 *  the right channel output
		 *  @type {GainNode}
		 */
		this.right = this.context.createGain();
		
		//connections
		this.input.connect(this.splitter);
		this.splitter.connect(this.left, 0, 0);
		this.splitter.connect(this.right, 1, 0);
	};

	Tone.extend(Tone.Split);

	/**
	 *  dispose method
	 */
	Tone.Add.prototype.dispose = function(){
		this._value.dispose();
		this.input.disconnect();
		this.output.disconnect();
		this._value = null;
		this.input = null;
		this.output = null;
	}; 

	return Tone.Split;
});
///////////////////////////////////////////////////////////////////////////////
//
//	WEB RTC MICROPHONE
//
///////////////////////////////////////////////////////////////////////////////

define('Tone/source/Microphone',["Tone/core/Tone", "Tone/source/Source"], function(Tone){

	/**
	 *  WebRTC Microphone
	 *
	 *  CHROME ONLY (for now) because of the 
	 *  use of the MediaStreamAudioSourceNode
	 *
	 *  @constructor
	 *  @extends {Tone.Source}
	 *  @param {number=} inputNum 
	 */
	Tone.Microphone = function(inputNum){
		Tone.call(this);

		/**
		 *  @type {MediaStreamAudioSourceNode}
		 *  @private
		 */
		this._mediaStream = null;
		/**
		 *  @type {LocalMediaStream}
		 *  @private
		 */
		this._stream = null;
		/**
		 *  @type {Object}
		 *  @private
		 */
		this.constraints = {"audio" : true};

		//get the option
		var self = this;
		MediaStreamTrack.getSources(function (media_sources) {
			if (inputNum < media_sources.length){
				self.constraints.audio = {
					optional : [{ sourceId: media_sources[inputNum].id}]
				};
			}
		});		
	};

	Tone.extend(Tone.Microphone, Tone.Source);

	/**
	 *  start the _stream. 
	 *  
	 *  accepts a time to stay consisten with other sources, even though 
	 *  it can't be stopped in a sample accurate way. 
	 *  uses setTimeout to approximate the behavior
	 * 
	 *  @param {Tone.Time} time
	 */
	Tone.Microphone.prototype.start = function(time){
		if (this.state === Tone.Source.State.STOPPED){
			this.state = Tone.Source.State.STARTED;
			if (time){
				var self = this;
				setTimeout(function(){
					navigator.getUserMedia(self.constraints, 
						self._onStream.bind(self), self._onStreamError.bind(self));
				}, this.toSeconds(time) * 1000);
			} else {
				navigator.getUserMedia(this.constraints, 
					this._onStream.bind(this), this._onStreamError.bind(this));
			}
			
		}
	};

	/**
	 *  stop the _stream. 
	 *  
	 *  accepts a time to stay consisten with other sources, even though 
	 *  it can't be stopped in a sample accurate way. 
	 *  uses setTimeout to approximate the behavior
	 * 
	 *  @param {Tone.Time} time
	 */
	Tone.Microphone.prototype.stop = function(time){
		if (this._stream && this.state === Tone.Source.State.STARTED){
			if (time){
				var self = this;
				setTimeout(function(){
					self.state = Tone.Source.State.STOPPED;
					self._stream.stop();
				}, this.toSeconds(time) * 1000);
			} else {
				this.state = Tone.Source.State.STOPPED;
				this._stream.stop();
			}
		}
	};

	/**
	 *  called when the _stream is successfully setup
	 *  @param   {LocalMediaStream} _stream 
	 *  @private
	 */
	Tone.Microphone.prototype._onStream = function(_stream) {
		this._stream = _stream;
		// Wrap a MediaStreamSourceNode around the live input _stream.
		this._mediaStream = this.context.createMediaStreamSource(_stream);
		this._mediaStream.connect(this.output);
	};

	/**
	 *  called on error
	 *  @param   {Error} e 
	 *  @private
	 */
	Tone.Microphone.prototype._onStreamError = function(e) {
		console.error(e);
	};

	/**
	 *  clean up
	 */
	Tone.Microphone.prototype.dispose = function(e) {
		this.input.disconnect();
		this.output.disconnect();
		this._stream.disconnect();
		this._mediaStream.disconnect();
		this.input = null;
		this.output = null;
		this._stream = null;
		this._mediaStream = null;
	};

	//polyfill
	navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || 
		navigator.mozGetUserMedia || navigator.msGetUserMedia;

	return Tone.Microphone;
});
define('Tone/source/Noise',["Tone/core/Tone", "Tone/source/Source"], function(Tone){

	var sampleRate = Tone.context.sampleRate;
	//two seconds per buffer
	var bufferLength = sampleRate * 4;

	/**
	 *  Noise generator. 
	 *
	 *  uses looped noise buffers to save on performance. 
	 *
	 *  @constructor
	 *  @extends {Tone.Source}
	 *  @param {string} type the noise type (white|pink|brown)
	 */
	Tone.Noise = function(type){

		Tone.Source.call(this);

		/**
		 *  @private
		 *  @type {AudioBufferSourceNode}
		 */
		this._source = null;
		
		/**
		 *  the buffer
		 *  @private
		 *  @type {AudioBuffer}
		 */
		this._buffer = null;

		/**
		 *  set a callback function to invoke when the sample is over
		 *  
		 *  @type {function}
		 */
		this.onended = function(){};

		this.setType(this.defaultArg(type, "white"));
	};

	Tone.extend(Tone.Noise, Tone.Source);

	/**
	 *  set the noise type
	 *  
	 *  @param {string} type the noise type (white|pink|brown)
	 *  @param {Tone.Time} time (optional) time that the set will occur
	 */
	Tone.Noise.prototype.setType = function(type, time){
		switch (type){
			case "white" : 
				this._buffer = _whiteNoise;
				break;
			case "pink" : 
				this._buffer = _pinkNoise;
				break;
			case "brown" : 
				this._buffer = _brownNoise;
				break;
			default : 
				this._buffer = _whiteNoise;
		}
		//if it's playing, stop and restart it
		if (this.state === Tone.Source.State.STARTED){
			time = this.toSeconds(time);
			//remove the listener
			this._source.onended = undefined;
			this._stop(time);
			this._start(time);
		}
	};

	/**
	 *  internal start method
	 *  
	 *  @type {Tone.Time} time
	 *  @private
	 */
	Tone.Noise.prototype._start = function(time){		
		this._source = this.context.createBufferSource();
		this._source.buffer = this._buffer;
		this._source.loop = true;
		this._source.start(this.toSeconds(time));
		this.chain(this._source, this.output);
		this._source.onended = this._onended.bind(this);
	};

	/**
	 *  start the noise at a specific time
	 *  
	 *  @type {Tone.Time} time
	 */
	Tone.Noise.prototype.start = function(time){
		if (this.state === Tone.Source.State.STOPPED){
			this.state = Tone.Source.State.STARTED;
			//make the source
			this._start(time);
		}
	};

	/**
	 *  internal stop method
	 *  
	 *  @type {Tone.Time} time
	 *  @private
	 */
	Tone.Noise.prototype._stop = function(time){
		this._source.stop(this.toSeconds(time));
	};


	/**
	 *  stop the noise at a specific time
	 *  
	 *  @type {Tone.Time} time
	 */
	Tone.Noise.prototype.stop = function(time){
		if (this.state === Tone.Source.State.STARTED) {
			if (this._buffer && this._source){
				if (!time){
					this.state = Tone.Source.State.STOPPED;
				}
				this._stop(time);
			}
		}
	};

	/**
	 *  internal call when the buffer is done playing
	 *  
	 *  @private
	 */
	Tone.Noise.prototype._onended = function(){
		this.state = Tone.Source.State.STOPPED;
		this.onended();
	};

	/**
	 *  dispose all the components
	 */
	Tone.Noise.prototype.dispose = function(){
		if (this._source !== null){
			this._source.disconnect();
			this._source = null;
		}
		this._buffer = null;
		this.output.disconnect();
		this.output = null;
	};


	///////////////////////////////////////////////////////////////////////////
	// THE BUFFERS
	// borred heavily from http://noisehack.com/generate-noise-web-audio-api/
	///////////////////////////////////////////////////////////////////////////

	/**
	 *	static brown noise buffer
	 *  
	 *  @static
	 *  @private
	 *  @type {AudioBuffer}
	 */
	var _pinkNoise = (function() {
		var buffer = Tone.context.createBuffer(2, bufferLength, sampleRate);
		for (var channelNum = 0; channelNum < buffer.numberOfChannels; channelNum++){
			var channel = buffer.getChannelData(channelNum);
			var b0, b1, b2, b3, b4, b5, b6;
			b0 = b1 = b2 = b3 = b4 = b5 = b6 = 0.0;
			for (var i = 0; i < bufferLength; i++) {
				var white = Math.random() * 2 - 1;
				b0 = 0.99886 * b0 + white * 0.0555179;
				b1 = 0.99332 * b1 + white * 0.0750759;
				b2 = 0.96900 * b2 + white * 0.1538520;
				b3 = 0.86650 * b3 + white * 0.3104856;
				b4 = 0.55000 * b4 + white * 0.5329522;
				b5 = -0.7616 * b5 - white * 0.0168980;
				channel[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
				channel[i] *= 0.11; // (roughly) compensate for gain
				b6 = white * 0.115926;
			}
		}
		return buffer;
	}());

	/**
	 *	static brown noise buffer
	 *  
	 *  @static
	 *  @private
	 *  @type {AudioBuffer}
	 */
	var _brownNoise = (function() {
		var buffer = Tone.context.createBuffer(2, bufferLength, sampleRate);
		for (var channelNum = 0; channelNum < buffer.numberOfChannels; channelNum++){
			var channel = buffer.getChannelData(channelNum);
			var lastOut = 0.0;
			for (var i = 0; i < bufferLength; i++) {
				var white = Math.random() * 2 - 1;
				channel[i] = (lastOut + (0.02 * white)) / 1.02;
				lastOut = channel[i];
				channel[i] *= 3.5; // (roughly) compensate for gain
			}
		}
		return buffer;
	})();

	/**
	 *	static white noise buffer
	 *  
	 *  @static
	 *  @private
	 *  @type {AudioBuffer}
	 */
	var _whiteNoise = (function(){
		var buffer = Tone.context.createBuffer(2, bufferLength, sampleRate);
		for (var channelNum = 0; channelNum < buffer.numberOfChannels; channelNum++){
			var channel = buffer.getChannelData(channelNum);
			for (var i = 0; i < bufferLength; i++){
				channel[i] =  Math.random() * 2 - 1;
			}
		}
		return buffer;
	}());

	return Tone.Noise;
});