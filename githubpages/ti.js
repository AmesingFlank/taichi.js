/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./src/backend/Kernel.ts":
/*!*******************************!*\
  !*** ./src/backend/Kernel.ts ***!
  \*******************************/
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.TaskParams = exports.CompiledKernel = exports.CompiledTask = void 0;
class TaskParams {
    constructor() {
        this.code = "";
        this.invocatoions = 0;
    }
}
exports.TaskParams = TaskParams;
class CompiledTask {
    constructor(device, params) {
        this.pipeline = null;
        this.bindGroup = null;
        this.device = device;
        this.params = params;
        this.createPipeline();
    }
    createPipeline() {
        this.pipeline = this.device.createComputePipeline({
            compute: {
                module: this.device.createShaderModule({
                    code: this.params.code,
                }),
                entryPoint: 'main',
            },
        });
    }
}
exports.CompiledTask = CompiledTask;
class CompiledKernel {
    constructor(device) {
        this.tasks = [];
        this.device = device;
    }
}
exports.CompiledKernel = CompiledKernel;


/***/ }),

/***/ "./src/backend/RenderRootBuffer.ts":
/*!*****************************************!*\
  !*** ./src/backend/RenderRootBuffer.ts ***!
  \*****************************************/
/***/ (function(__unused_webpack_module, exports) {


var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.RootBufferRenderer = exports.fragShader = void 0;
const vertShader = `
struct Input {
  [[location(0)]] position: vec2<f32>;
};

struct Output {
  [[builtin(position)]] Position : vec4<f32>;
  [[location(5)]] fragPos: vec2<f32>;
};

[[stage(vertex)]]

fn main (input: Input) -> Output {
  var output: Output;
  
  output.Position = vec4<f32>(input.position,0.0,1.0);
  output.fragPos = vec2<f32>(input.position) ;
  return output;
}
`;
exports.fragShader = `
struct Input {
  [[location(5)]] fragPos: vec2<f32>;
};

[[block]]
struct RootBufferType {
    member: [[stride(4)]] array<f32>;
};
[[group(0), binding(0)]]
var<storage, read_write> rootBuffer: RootBufferType;

[[block]]
struct UniformBufferType {
  width : i32;
  height : i32;
};
[[binding(1), group(0)]] 
var<uniform> ubo : UniformBufferType;


[[stage(fragment)]]

fn main (input: Input) -> [[location(0)]] vec4<f32> {
    var fragPos = input.fragPos;
    fragPos = (fragPos + 1.0 ) / 2.0 ;
    if(fragPos.x == fragPos.y * 123456.0){
      return vec4<f32>(f32(ubo.width),f32(ubo.height),f32(rootBuffer.member[0]), 1.0);
    }
    var working = vec4<f32>(fragPos,0.0, 1.0);

    var cellPos = vec2<i32>(i32(fragPos.x*f32(ubo.width)), i32(fragPos.y*f32(ubo.height)));
    var pixelIndex = cellPos.x * ubo.height + cellPos.y;
    //pixelIndex = cellPos.y * ubo.width + cellPos.x;
    var result = vec4<f32>(
        (rootBuffer.member[pixelIndex * 4 + 0]),
        (rootBuffer.member[pixelIndex * 4 + 1]),
        (rootBuffer.member[pixelIndex * 4 + 2]),
        (rootBuffer.member[pixelIndex * 4 + 3])
    );

    //result = vec4<f32>(f32(pixelIndex)/500000.0, 0.0,0.0, 1.0);// + 0.01 * result / (result + 0.01);

    //result = working;
    return result;
}
`;
class RootBufferRenderer {
    constructor(adapter, device, buffer) {
        this.context = null;
        this.vertexBuffer = null;
        this.uniformBuffer = null;
        this.pipeline = null;
        this.presentationFormat = null;
        this.bindGroup = null;
        this.adapter = adapter;
        this.device = device;
        this.buffer = buffer;
    }
    init() {
        const vertices = new Float32Array([
            -1, -1,
            1, 1,
            1, -1,
            -1, -1,
            -1, 1,
            1, 1
        ]);
        this.vertexBuffer = this.device.createBuffer({
            size: vertices.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true,
        });
        new Float32Array(this.vertexBuffer.getMappedRange()).set(vertices);
        this.vertexBuffer.unmap();
        this.uniformBuffer = this.device.createBuffer({
            size: vertices.byteLength,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            mappedAtCreation: false,
        });
        this.pipeline = this.device.createRenderPipeline({
            vertex: {
                module: this.device.createShaderModule({
                    code: vertShader,
                }),
                entryPoint: 'main',
                buffers: [
                    {
                        arrayStride: 2 * Float32Array.BYTES_PER_ELEMENT,
                        attributes: [
                            {
                                shaderLocation: 0,
                                format: 'float32x2',
                                offset: 0,
                            },
                        ],
                    },
                ],
            },
            fragment: {
                module: this.device.createShaderModule({
                    code: exports.fragShader,
                }),
                entryPoint: 'main',
                targets: [
                    {
                        format: this.presentationFormat,
                    },
                ],
            },
            primitive: {
                topology: 'triangle-list',
                stripIndexFormat: undefined,
            },
        });
        this.bindGroup = this.device.createBindGroup({
            layout: this.pipeline.getBindGroupLayout(0),
            entries: [
                {
                    binding: 0,
                    resource: {
                        buffer: this.buffer,
                    },
                },
                {
                    binding: 1,
                    resource: {
                        buffer: this.uniformBuffer
                    },
                },
            ],
        });
    }
    render(width, height) {
        return __awaiter(this, void 0, void 0, function* () {
            this.device.queue.writeBuffer(this.uniformBuffer, 0, new Int32Array([
                width, height
            ]));
            const commandEncoder = this.device.createCommandEncoder();
            {
                const renderPassDescriptor = {
                    colorAttachments: [
                        {
                            view: this.context.getCurrentTexture().createView(),
                            loadValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
                            storeOp: 'store',
                        },
                    ],
                };
                const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
                passEncoder.setPipeline(this.pipeline);
                passEncoder.setVertexBuffer(0, this.vertexBuffer);
                passEncoder.setBindGroup(0, this.bindGroup);
                passEncoder.draw(6, 1, 0, 0);
                passEncoder.endPass();
            }
            this.device.queue.submit([commandEncoder.finish()]);
            yield this.device.queue.onSubmittedWorkDone();
        });
    }
    initForCanvas(canvas) {
        return __awaiter(this, void 0, void 0, function* () {
            this.context = canvas.getContext('webgpu');
            this.presentationFormat = this.context.getPreferredFormat(this.adapter);
            this.context.configure({
                device: this.device,
                format: this.presentationFormat,
            });
            this.init();
        });
    }
}
exports.RootBufferRenderer = RootBufferRenderer;


/***/ }),

/***/ "./src/backend/Runtime.ts":
/*!********************************!*\
  !*** ./src/backend/Runtime.ts ***!
  \********************************/
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.Runtime = void 0;
const Kernel_1 = __webpack_require__(/*! ./Kernel */ "./src/backend/Kernel.ts");
const Utils_1 = __webpack_require__(/*! ../utils/Utils */ "./src/utils/Utils.ts");
const RenderRootBuffer_1 = __webpack_require__(/*! ./RenderRootBuffer */ "./src/backend/RenderRootBuffer.ts");
class MaterializedTree {
}
class Runtime {
    constructor() {
        this.adapter = null;
        this.device = null;
        this.kernels = [];
        this.materialzedTrees = [];
    }
    init() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.createDevice();
        });
    }
    createDevice() {
        return __awaiter(this, void 0, void 0, function* () {
            if (navigator.gpu === undefined) {
                alert("Webgpu not supported");
            }
            const adapter = yield navigator.gpu.requestAdapter();
            const device = yield adapter.requestDevice();
            this.device = device;
            this.adapter = adapter;
        });
    }
    createTask(params) {
        let task = new Kernel_1.CompiledTask(this.device, params);
        return task;
    }
    createKernel(tasksParams) {
        let kernel = new Kernel_1.CompiledKernel(this.device);
        for (let params of tasksParams) {
            let task = this.createTask(params);
            kernel.tasks.push(task);
        }
        return kernel;
    }
    sync() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.device.queue.onSubmittedWorkDone();
        });
    }
    launchKernel(kernel) {
        let commandEncoder = this.device.createCommandEncoder();
        const passEncoder = commandEncoder.beginComputePass();
        for (let task of kernel.tasks) {
            if (task.bindGroup === null) {
                task.bindGroup = this.device.createBindGroup({
                    layout: task.pipeline.getBindGroupLayout(0),
                    entries: [
                        {
                            binding: 0,
                            resource: {
                                buffer: this.materialzedTrees[0].rootBuffer,
                            },
                        },
                    ],
                });
            }
            passEncoder.setPipeline(task.pipeline);
            passEncoder.setBindGroup(0, task.bindGroup);
            let numWorkGroups = (0, Utils_1.divUp)(task.params.invocatoions, 128);
            passEncoder.dispatch(numWorkGroups);
        }
        passEncoder.endPass();
        this.device.queue.submit([commandEncoder.finish()]);
    }
    materializeTree(tree) {
        let size = tree.size;
        let rootBuffer = this.device.createBuffer({
            size: size,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
        });
        let device = this.device;
        let materialized = {
            tree,
            rootBuffer,
            device
        };
        this.materialzedTrees.push(materialized);
    }
    copyRootBufferToHost(treeId) {
        return __awaiter(this, void 0, void 0, function* () {
            let size = this.materialzedTrees[treeId].tree.size;
            const rootBufferCopy = this.device.createBuffer({
                size: size,
                usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
            });
            let commandEncoder = this.device.createCommandEncoder();
            commandEncoder.copyBufferToBuffer(this.materialzedTrees[treeId].rootBuffer, 0, rootBufferCopy, 0, size);
            this.device.queue.submit([commandEncoder.finish()]);
            yield this.device.queue.onSubmittedWorkDone();
            yield rootBufferCopy.mapAsync(GPUMapMode.READ);
            let result = new Int32Array(rootBufferCopy.getMappedRange());
            let copied = result.slice();
            rootBufferCopy.unmap();
            rootBufferCopy.destroy();
            return copied;
        });
    }
    getRootBufferRenderer(canvas) {
        return __awaiter(this, void 0, void 0, function* () {
            let renderer = new RenderRootBuffer_1.RootBufferRenderer(this.adapter, this.device, this.materialzedTrees[0].rootBuffer);
            yield renderer.initForCanvas(canvas);
            return renderer;
        });
    }
}
exports.Runtime = Runtime;


/***/ }),

/***/ "./src/examples/computeBoids/main.ts":
/*!*******************************************!*\
  !*** ./src/examples/computeBoids/main.ts ***!
  \*******************************************/
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.computeBoids = void 0;
const sprite_wgsl_1 = __webpack_require__(/*! ./sprite.wgsl */ "./src/examples/computeBoids/sprite.wgsl.ts");
const updateSprites_wgsl_1 = __webpack_require__(/*! ./updateSprites.wgsl */ "./src/examples/computeBoids/updateSprites.wgsl.ts");
let computeBoids = (canvas) => __awaiter(void 0, void 0, void 0, function* () {
    const adapter = yield navigator.gpu.requestAdapter();
    const device = yield adapter.requestDevice();
    const context = canvas.getContext('webgpu');
    const devicePixelRatio = window.devicePixelRatio || 1;
    const presentationSize = [
        canvas.clientWidth * devicePixelRatio,
        canvas.clientHeight * devicePixelRatio,
    ];
    const presentationFormat = context.getPreferredFormat(adapter);
    context.configure({
        device,
        format: presentationFormat,
        size: presentationSize,
    });
    const spriteShaderModule = device.createShaderModule({ code: sprite_wgsl_1.shader });
    const renderPipeline = device.createRenderPipeline({
        vertex: {
            module: spriteShaderModule,
            entryPoint: 'vert_main',
            buffers: [
                {
                    // instanced particles buffer
                    arrayStride: 4 * 4,
                    stepMode: 'instance',
                    attributes: [
                        {
                            // instance position
                            shaderLocation: 0,
                            offset: 0,
                            format: 'float32x2',
                        },
                        {
                            // instance velocity
                            shaderLocation: 1,
                            offset: 2 * 4,
                            format: 'float32x2',
                        },
                    ],
                },
                {
                    // vertex buffer
                    arrayStride: 2 * 4,
                    stepMode: 'vertex',
                    attributes: [
                        {
                            // vertex positions
                            shaderLocation: 2,
                            offset: 0,
                            format: 'float32x2',
                        },
                    ],
                },
            ],
        },
        fragment: {
            module: spriteShaderModule,
            entryPoint: 'frag_main',
            targets: [
                {
                    format: presentationFormat,
                },
            ],
        },
        primitive: {
            topology: 'triangle-list',
        },
    });
    const computePipeline = device.createComputePipeline({
        compute: {
            module: device.createShaderModule({
                code: updateSprites_wgsl_1.shader,
            }),
            entryPoint: 'main',
        },
    });
    // prettier-ignore
    const vertexBufferData = new Float32Array([
        -0.01, -0.02, 0.01,
        -0.02, 0.0, 0.02,
    ]);
    const spriteVertexBuffer = device.createBuffer({
        size: vertexBufferData.byteLength,
        usage: GPUBufferUsage.VERTEX,
        mappedAtCreation: true,
    });
    new Float32Array(spriteVertexBuffer.getMappedRange()).set(vertexBufferData);
    spriteVertexBuffer.unmap();
    const simParams = {
        deltaT: 0.04,
        rule1Distance: 0.1,
        rule2Distance: 0.025,
        rule3Distance: 0.025,
        rule1Scale: 0.02,
        rule2Scale: 0.05,
        rule3Scale: 0.005,
    };
    const simParamBufferSize = 7 * Float32Array.BYTES_PER_ELEMENT;
    const simParamBuffer = device.createBuffer({
        size: simParamBufferSize,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    function updateSimParams() {
        device.queue.writeBuffer(simParamBuffer, 0, new Float32Array([
            simParams.deltaT,
            simParams.rule1Distance,
            simParams.rule2Distance,
            simParams.rule3Distance,
            simParams.rule1Scale,
            simParams.rule2Scale,
            simParams.rule3Scale,
        ]));
    }
    updateSimParams();
    const numParticles = 1500;
    const initialParticleData = new Float32Array(numParticles * 4);
    for (let i = 0; i < numParticles; ++i) {
        initialParticleData[4 * i + 0] = 2 * (Math.random() - 0.5);
        initialParticleData[4 * i + 1] = 2 * (Math.random() - 0.5);
        initialParticleData[4 * i + 2] = 2 * (Math.random() - 0.5) * 0.1;
        initialParticleData[4 * i + 3] = 2 * (Math.random() - 0.5) * 0.1;
    }
    const particleBuffers = new Array(2);
    const particleBindGroups = new Array(2);
    for (let i = 0; i < 2; ++i) {
        particleBuffers[i] = device.createBuffer({
            size: initialParticleData.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.STORAGE,
            mappedAtCreation: true,
        });
        new Float32Array(particleBuffers[i].getMappedRange()).set(initialParticleData);
        particleBuffers[i].unmap();
    }
    for (let i = 0; i < 2; ++i) {
        particleBindGroups[i] = device.createBindGroup({
            layout: computePipeline.getBindGroupLayout(0),
            entries: [
                {
                    binding: 0,
                    resource: {
                        buffer: simParamBuffer,
                    },
                },
                {
                    binding: 1,
                    resource: {
                        buffer: particleBuffers[i],
                        offset: 0,
                        size: initialParticleData.byteLength,
                    },
                },
                {
                    binding: 2,
                    resource: {
                        buffer: particleBuffers[(i + 1) % 2],
                        offset: 0,
                        size: initialParticleData.byteLength,
                    },
                },
            ],
        });
    }
    let t = 0;
    function frame() {
        const commandEncoder = device.createCommandEncoder();
        {
            const passEncoder = commandEncoder.beginComputePass();
            passEncoder.setPipeline(computePipeline);
            passEncoder.setBindGroup(0, particleBindGroups[t % 2]);
            passEncoder.dispatch(Math.ceil(numParticles / 64));
            passEncoder.endPass();
        }
        {
            const renderPassDescriptor = {
                colorAttachments: [
                    {
                        view: context.getCurrentTexture().createView(),
                        loadValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
                        storeOp: 'store',
                    },
                ],
            };
            const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
            passEncoder.setPipeline(renderPipeline);
            passEncoder.setVertexBuffer(0, particleBuffers[(t + 1) % 2]);
            passEncoder.setVertexBuffer(1, spriteVertexBuffer);
            passEncoder.draw(3, numParticles, 0, 0);
            passEncoder.endPass();
        }
        device.queue.submit([commandEncoder.finish()]);
        ++t;
        requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
});
exports.computeBoids = computeBoids;


/***/ }),

/***/ "./src/examples/computeBoids/sprite.wgsl.ts":
/*!**************************************************!*\
  !*** ./src/examples/computeBoids/sprite.wgsl.ts ***!
  \**************************************************/
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.shader = void 0;
exports.shader = `
[[stage(vertex)]]
fn vert_main([[location(0)]] a_particlePos : vec2<f32>,
             [[location(1)]] a_particleVel : vec2<f32>,
             [[location(2)]] a_pos : vec2<f32>) -> [[builtin(position)]] vec4<f32> {
  let angle = -atan2(a_particleVel.x, a_particleVel.y);
  let pos = vec2<f32>(
      (a_pos.x * cos(angle)) - (a_pos.y * sin(angle)),
      (a_pos.x * sin(angle)) + (a_pos.y * cos(angle)));
  return vec4<f32>(pos + a_particlePos, 0.0, 1.0);
}

[[stage(fragment)]]
fn frag_main() -> [[location(0)]] vec4<f32> {
  return vec4<f32>(1.0, 1.0, 1.0, 1.0);
}

`;


/***/ }),

/***/ "./src/examples/computeBoids/updateSprites.wgsl.ts":
/*!*********************************************************!*\
  !*** ./src/examples/computeBoids/updateSprites.wgsl.ts ***!
  \*********************************************************/
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.shader = void 0;
exports.shader = `
struct Particle {
  pos : vec2<f32>;
  vel : vec2<f32>;
};
[[block]] struct SimParams {
  deltaT : f32;
  rule1Distance : f32;
  rule2Distance : f32;
  rule3Distance : f32;
  rule1Scale : f32;
  rule2Scale : f32;
  rule3Scale : f32;
};
[[block]] struct Particles {
  particles : [[stride(16)]] array<Particle>;
};
[[binding(0), group(0)]] var<uniform> params : SimParams;
[[binding(1), group(0)]] var<storage, read> particlesA : Particles;
[[binding(2), group(0)]] var<storage, read_write> particlesB : Particles;

// https://github.com/austinEng/Project6-Vulkan-Flocking/blob/master/data/shaders/computeparticles/particle.comp
[[stage(compute), workgroup_size(64)]]
fn main([[builtin(global_invocation_id)]] GlobalInvocationID : vec3<u32>) {
  var index : u32 = GlobalInvocationID.x;

  var vPos = particlesA.particles[index].pos;
  var vVel = particlesA.particles[index].vel;
  var cMass = vec2<f32>(0.0, 0.0);
  var cVel = vec2<f32>(0.0, 0.0);
  var colVel = vec2<f32>(0.0, 0.0);
  var cMassCount : u32 = 0u;
  var cVelCount : u32 = 0u;
  var pos : vec2<f32>;
  var vel : vec2<f32>;

  for (var i : u32 = 0u; i < arrayLength(&particlesA.particles); i = i + 1u) {
    if (i == index) {
      continue;
    }

    pos = particlesA.particles[i].pos.xy;
    vel = particlesA.particles[i].vel.xy;
    if (distance(pos, vPos) < params.rule1Distance) {
      cMass = cMass + pos;
      cMassCount = cMassCount + 1u;
    }
    if (distance(pos, vPos) < params.rule2Distance) {
      colVel = colVel - (pos - vPos);
    }
    if (distance(pos, vPos) < params.rule3Distance) {
      cVel = cVel + vel;
      cVelCount = cVelCount + 1u;
    }
  }
  if (cMassCount > 0u) {
    var temp = f32(cMassCount);
    cMass = (cMass / vec2<f32>(temp, temp)) - vPos;
  }
  if (cVelCount > 0u) {
    var temp = f32(cVelCount);
    cVel = cVel / vec2<f32>(temp, temp);
  }
  vVel = vVel + (cMass * params.rule1Scale) + (colVel * params.rule2Scale) +
      (cVel * params.rule3Scale);

  // clamp velocity for a more pleasing simulation
  vVel = normalize(vVel) * clamp(length(vVel), 0.0, 0.1);
  // kinematic update
  vPos = vPos + (vVel * params.deltaT);
  // Wrap around boundary
  if (vPos.x < -1.0) {
    vPos.x = 1.0;
  }
  if (vPos.x > 1.0) {
    vPos.x = -1.0;
  }
  if (vPos.y < -1.0) {
    vPos.y = 1.0;
  }
  if (vPos.y > 1.0) {
    vPos.y = -1.0;
  }
  // Write back
  particlesB.particles[index].pos = vPos;
  particlesB.particles[index].vel = vVel;
}

`;


/***/ }),

/***/ "./src/examples/taichi0/init0.wgsl.ts":
/*!********************************************!*\
  !*** ./src/examples/taichi0/init0.wgsl.ts ***!
  \********************************************/
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.shader = void 0;
exports.shader = `
[[block]]
struct type_7 {
    member: [[stride(4)]] array<i32>;
};

let total_elems: i32 = 10;

let tmp665_: u32 = 0u;

let total_invocs: i32 = 128;

let tmp674_: i32 = 0;

let tmp676_: i32 = 15;

var<private> global: vec3<u32>;
[[group(0), binding(0)]]
var<storage, read_write> root_buffer_0_: type_7;

fn main_1() {
    var phi_29_: i32;

    let e18 = global[tmp665_];
    phi_29_ = bitcast<i32>(e18);
    loop {
        let e21 = phi_29_;
        if ((e21 < total_elems)) {
            continue;
        } else {
            break;
        }
        continuing {
            root_buffer_0_.member[((bitcast<u32>(((e21 >> bitcast<u32>(tmp674_)) & tmp676_)) * 4u) >> bitcast<u32>(2u))] = e21;
            phi_29_ = (e21 + total_invocs);
        }
    }
    return;
}

[[stage(compute), workgroup_size(128, 1, 1)]]
fn main([[builtin(global_invocation_id)]] param: vec3<u32>) {
    global = param;
    main_1();
}
`;


/***/ }),

/***/ "./src/examples/taichi0/main.ts":
/*!**************************************!*\
  !*** ./src/examples/taichi0/main.ts ***!
  \**************************************/
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.taichiExample0 = void 0;
const init0_wgsl_1 = __webpack_require__(/*! ./init0.wgsl */ "./src/examples/taichi0/init0.wgsl.ts");
let taichiExample0 = () => __awaiter(void 0, void 0, void 0, function* () {
    const adapter = yield navigator.gpu.requestAdapter();
    const device = yield adapter.requestDevice();
    const computePipeline = device.createComputePipeline({
        compute: {
            module: device.createShaderModule({
                code: init0_wgsl_1.shader,
            }),
            entryPoint: 'main',
        },
    });
    const rootBuffer = device.createBuffer({
        size: 1024,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
    });
    const bindGroup = device.createBindGroup({
        layout: computePipeline.getBindGroupLayout(0),
        entries: [
            {
                binding: 0,
                resource: {
                    buffer: rootBuffer,
                },
            },
        ],
    });
    let commandEncoder = device.createCommandEncoder();
    {
        const passEncoder = commandEncoder.beginComputePass();
        passEncoder.setPipeline(computePipeline);
        passEncoder.setBindGroup(0, bindGroup);
        passEncoder.dispatch(1, 1, 1);
        passEncoder.endPass();
    }
    device.queue.submit([commandEncoder.finish()]);
    yield device.queue.onSubmittedWorkDone();
    const rootBufferCopy = device.createBuffer({
        size: 1024,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });
    commandEncoder = device.createCommandEncoder();
    commandEncoder.copyBufferToBuffer(rootBuffer, 0, rootBufferCopy, 0, 1024);
    device.queue.submit([commandEncoder.finish()]);
    yield device.queue.onSubmittedWorkDone();
    yield rootBufferCopy.mapAsync(GPUMapMode.READ);
    let result = new Int32Array(rootBufferCopy.getMappedRange());
    console.log("Example 0 results:");
    console.log(result);
    rootBufferCopy.unmap();
});
exports.taichiExample0 = taichiExample0;


/***/ }),

/***/ "./src/examples/taichi1/init0.wgsl.ts":
/*!********************************************!*\
  !*** ./src/examples/taichi1/init0.wgsl.ts ***!
  \********************************************/
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.shader = void 0;
exports.shader = `
[[block]]
struct type_7 {
    member: [[stride(4)]] array<i32>;
};

let total_elems: i32 = 10;

let tmp665_: u32 = 0u;

let total_invocs: i32 = 128;

let tmp674_: i32 = 0;

let tmp676_: i32 = 15;

var<private> global: vec3<u32>;
[[group(0), binding(0)]]
var<storage, read_write> root_buffer_0_: type_7;

fn main_1() {
    var phi_29_: i32;

    let e18 = global[tmp665_];
    phi_29_ = bitcast<i32>(e18);
    loop {
        let e21 = phi_29_;
        if ((e21 < total_elems)) {
            continue;
        } else {
            break;
        }
        continuing {
            root_buffer_0_.member[((bitcast<u32>(((e21 >> bitcast<u32>(tmp674_)) & tmp676_)) * 4u) >> bitcast<u32>(2u))] = e21;
            phi_29_ = (e21 + total_invocs);
        }
    }
    return;
}

[[stage(compute), workgroup_size(128, 1, 1)]]
fn main([[builtin(global_invocation_id)]] param: vec3<u32>) {
    global = param;
    main_1();
}
`;


/***/ }),

/***/ "./src/examples/taichi1/main.ts":
/*!**************************************!*\
  !*** ./src/examples/taichi1/main.ts ***!
  \**************************************/
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.taichiExample1 = void 0;
const init0_wgsl_1 = __webpack_require__(/*! ./init0.wgsl */ "./src/examples/taichi1/init0.wgsl.ts");
const Program_1 = __webpack_require__(/*! ../../program/Program */ "./src/program/Program.ts");
const FieldsFactory_1 = __webpack_require__(/*! ../../program/FieldsFactory */ "./src/program/FieldsFactory.ts");
let taichiExample1 = () => __awaiter(void 0, void 0, void 0, function* () {
    yield Program_1.program.materializeRuntime();
    let x = (0, FieldsFactory_1.field)([10]);
    Program_1.program.materializeCurrentTree();
    let initKernel = Program_1.program.runtime.createKernel([{
            code: init0_wgsl_1.shader,
            invocatoions: 10
        }]);
    Program_1.program.runtime.launchKernel(initKernel);
    yield Program_1.program.runtime.sync();
    let rootBufferCopy = yield Program_1.program.runtime.copyRootBufferToHost(0);
    console.log("Example 1 results:");
    console.log(rootBufferCopy);
});
exports.taichiExample1 = taichiExample1;


/***/ }),

/***/ "./src/examples/taichi2_vortex_ring/advect_c56_0_k0005_vk_t00.ts":
/*!***********************************************************************!*\
  !*** ./src/examples/taichi2_vortex_ring/advect_c56_0_k0005_vk_t00.ts ***!
  \***********************************************************************/
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.shader = void 0;
exports.shader = `
[[block]]
struct type_8 {
    member: [[stride(4)]] array<i32>;
};

let totale_lems: i32 = 200000;

let tmp1294_: u32 = 0u;

let total_invocs: i32 = 200064;

let tmp1485_: i32 = 3;

let tmp1_: f32 = 1.0;

let tmp3_: f32 = 0.5;

let tmp4_: f32 = 3.1415927410125732;

let tmp1503_: i32 = 0;

let tmp1445_: i32 = 262143;

let tmp13_: i32 = 4;

let tmp51_: f32 = 0.05000000074505806;

let tmp95_: f32 = 0.07500000298023224;

let tmp138_: f32 = 0.2222222238779068;

let tmp143_: f32 = 0.3333333432674408;

let tmp150_: f32 = 0.4444444477558136;

let tmp156_: f32 = 0.10000000149011612;

var<private> global: vec3<u32>;
[[group(0), binding(0)]]
var<storage, read_write> root_buffer_0_: type_8;

fn main_1() {
    var phi_29_: i32;
    var phi_298_: f32;
    var phi_297_: f32;
    var phi_76_: i32;
    var local: f32;
    var local_1: f32;
    var phi_300_: f32;
    var phi_299_: f32;
    var phi_144_: i32;
    var local_2: f32;
    var local_3: f32;
    var phi_308_: f32;
    var phi_307_: f32;
    var phi_210_: i32;
    var local_4: f32;
    var local_5: f32;
    var local_6: f32;
    var local_7: f32;
    var local_8: f32;
    var local_9: f32;

    let e_38 = global[tmp1294_];
    phi_29_ = bitcast<i32>(e_38);
    loop {
        let e_41 = phi_29_;
        if ((e_41 < totale_lems)) {
            let e_45 = (bitcast<u32>((e_41 & tmp1445_)) * 8u);
            let e_51 = root_buffer_0_.member[((8388688u + e_45) >> bitcast<u32>(2u))];
            let e_52 = bitcast<f32>(e_51);
            let e_58 = root_buffer_0_.member[((e_45 + 8388692u) >> bitcast<u32>(2u))];
            let e_59 = bitcast<f32>(e_58);
            phi_298_ = 0.0;
            phi_297_ = 0.0;
            phi_76_ = tmp1503_;
            loop {
                let e_61 = phi_298_;
                let e_63 = phi_297_;
                let e_65 = phi_76_;
                local = e_63;
                local_1 = e_61;
                local_4 = e_63;
                local_5 = e_61;
                if ((e_65 < tmp13_)) {
                    continue;
                } else {
                    break;
                }
                continuing {
                    let e_68 = bitcast<u32>((e_65 & tmp1485_));
                    let e_69 = (e_68 * 8u);
                    let e_75 = root_buffer_0_.member[((8388608u + e_69) >> bitcast<u32>(2u))];
                    let e_77 = (e_52 - bitcast<f32>(e_75));
                    let e_83 = root_buffer_0_.member[((e_69 + 8388612u) >> bitcast<u32>(2u))];
                    let e_84 = bitcast<f32>(e_83);
                    let e_85 = (e_59 - e_84);
                    let e_89 = sqrt(((e_77 * e_77) + (e_85 * e_85)));
                    let e_90 = (e_89 * e_89);
                    let e_98 = root_buffer_0_.member[((8388672u + (e_68 * 4u)) >> bitcast<u32>(2u))];
                    let e_99 = bitcast<f32>(e_98);
                    let e_102 = (e_90 * tmp4_);
                    let e_109 = (tmp1_ - exp((e_90 * -10000.0)));
                    phi_298_ = (e_61 + ((((e_99 * e_77) / e_102) * tmp3_) * e_109));
                    phi_297_ = (e_63 + ((((e_99 * (e_84 - e_59)) / e_102) * tmp3_) * e_109));
                    phi_76_ = (e_65 + 1);
                }
            }
            let e_116 = local;
            let e_119 = local_1;
            let e_122 = (e_59 + (e_119 * tmp51_));
            phi_300_ = 0.0;
            phi_299_ = 0.0;
            phi_144_ = tmp1503_;
            loop {
                let e_124 = phi_300_;
                let e_126 = phi_299_;
                let e_128 = phi_144_;
                local_2 = e_126;
                local_3 = e_124;
                local_6 = e_126;
                local_7 = e_124;
                if ((e_128 < tmp13_)) {
                    continue;
                } else {
                    break;
                }
                continuing {
                    let e_131 = bitcast<u32>((e_128 & tmp1485_));
                    let e_132 = (e_131 * 8u);
                    let e_138 = root_buffer_0_.member[((8388608u + e_132) >> bitcast<u32>(2u))];
                    let e_140 = ((e_52 + (e_116 * tmp51_)) - bitcast<f32>(e_138));
                    let e_146 = root_buffer_0_.member[((e_132 + 8388612u) >> bitcast<u32>(2u))];
                    let e_147 = bitcast<f32>(e_146);
                    let e_148 = (e_122 - e_147);
                    let e_152 = sqrt(((e_140 * e_140) + (e_148 * e_148)));
                    let e_153 = (e_152 * e_152);
                    let e_161 = root_buffer_0_.member[((8388672u + (e_131 * 4u)) >> bitcast<u32>(2u))];
                    let e_162 = bitcast<f32>(e_161);
                    let e_165 = (e_153 * tmp4_);
                    let e_172 = (tmp1_ - exp((e_153 * -10000.0)));
                    phi_300_ = (e_124 + ((((e_162 * e_140) / e_165) * tmp3_) * e_172));
                    phi_299_ = (e_126 + ((((e_162 * (e_147 - e_122)) / e_165) * tmp3_) * e_172));
                    phi_144_ = (e_128 + 1);
                }
            }
            let e_179 = local_2;
            let e_182 = local_3;
            let e_185 = (e_59 + (e_182 * tmp95_));
            phi_308_ = 0.0;
            phi_307_ = 0.0;
            phi_210_ = tmp1503_;
            loop {
                let e_187 = phi_308_;
                let e_189 = phi_307_;
                let e_191 = phi_210_;
                local_8 = e_189;
                local_9 = e_187;
                if ((e_191 < tmp13_)) {
                    continue;
                } else {
                    break;
                }
                continuing {
                    let e_194 = bitcast<u32>((e_191 & tmp1485_));
                    let e_195 = (e_194 * 8u);
                    let e_201 = root_buffer_0_.member[((8388608u + e_195) >> bitcast<u32>(2u))];
                    let e_203 = ((e_52 + (e_179 * tmp95_)) - bitcast<f32>(e_201));
                    let e_209 = root_buffer_0_.member[((e_195 + 8388612u) >> bitcast<u32>(2u))];
                    let e_210 = bitcast<f32>(e_209);
                    let e_211 = (e_185 - e_210);
                    let e_215 = sqrt(((e_203 * e_203) + (e_211 * e_211)));
                    let e_216 = (e_215 * e_215);
                    let e_224 = root_buffer_0_.member[((8388672u + (e_194 * 4u)) >> bitcast<u32>(2u))];
                    let e_225 = bitcast<f32>(e_224);
                    let e_228 = (e_216 * tmp4_);
                    let e_235 = (tmp1_ - exp((e_216 * -10000.0)));
                    phi_308_ = (e_187 + ((((e_225 * e_203) / e_228) * tmp3_) * e_235));
                    phi_307_ = (e_189 + ((((e_225 * (e_210 - e_185)) / e_228) * tmp3_) * e_235));
                    phi_210_ = (e_191 + 1);
                }
            }
            let e_242 = local_4;
            let e_245 = local_5;
            let e_248 = local_6;
            let e_251 = local_7;
            let e_256 = local_8;
            let e_259 = local_9;
            root_buffer_0_.member[((8388688u + e_45) >> bitcast<u32>(2u))] = bitcast<i32>((e_52 + ((((e_242 * tmp138_) + (e_248 * tmp143_)) + (e_256 * tmp150_)) * tmp156_)));
            root_buffer_0_.member[((e_45 + 8388692u) >> bitcast<u32>(2u))] = bitcast<i32>((e_59 + ((((e_245 * tmp138_) + (e_251 * tmp143_)) + (e_259 * tmp150_)) * tmp156_)));
            continue;
        } else {
            break;
        }
        continuing {
            phi_29_ = (e_41 + total_invocs);
        }
    }
    return;
}

[[stage(compute), workgroup_size(128, 1, 1)]]
fn main([[builtin(global_invocation_id)]] param: vec3<u32>) {
    global = param;
    main_1();
}

`;


/***/ }),

/***/ "./src/examples/taichi2_vortex_ring/init_tracers_c58_0_k0003_vk_t00.ts":
/*!*****************************************************************************!*\
  !*** ./src/examples/taichi2_vortex_ring/init_tracers_c58_0_k0003_vk_t00.ts ***!
  \*****************************************************************************/
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.shader = void 0;
exports.shader = `
[[block]]
struct type_8 {
    member: [[stride(4)]] array<i32>;
};

let totale_lems: i32 = 200000;

let tmp131_: u32 = 0u;

let total_invocs: i32 = 200064;

let tmp4_: f32 = 0.5;

let tmp8_: f32 = 1.5;

let tmp152_: i32 = 262143;

var<private> global: vec3<u32>;
// [[group(0), binding(2)]]
// var<storage, read_write> global_tmps_buffer: type_8;
[[group(0), binding(0)]]
var<storage, read_write> root_buffer_0_: type_8;

fn main_1() {
    var phi_136_: u32;
    var phi_135_: u32;
    var phi_134_: u32;
    var phi_133_: u32;
    var phi_29_: i32;

    let e_38 = global[tmp131_];
    // let e_39 = global_tmps_buffer.member[1024];
    // let e_46 = global_tmps_buffer.member[1024];
    // global_tmps_buffer.member[1024] = (e_46 + 1);
    let e_39 = 0;
    phi_136_ = 88675123u;
    phi_135_ = 521288629u;
    phi_134_ = 362436069u;
    phi_133_ = (((7654321u + e_38) * (1234567u + (9723451u * bitcast<u32>(e_39)))) * 3640077715u);
    phi_29_ = bitcast<i32>(e_38);
    loop {
        let e_50 = phi_136_;
        let e_52 = phi_135_;
        let e_54 = phi_134_;
        let e_56 = phi_133_;
        let e_58 = phi_29_;
        if ((e_58 < totale_lems)) {
            continue;
        } else {
            break;
        }
        continuing {
            let e_62 = (e_56 ^ (e_56 << bitcast<u32>(11u)));
            let e_69 = ((e_50 ^ (e_50 >> bitcast<u32>(19u))) ^ (e_62 ^ (e_62 >> bitcast<u32>(8u))));
            let e_75 = (e_54 ^ (e_54 << bitcast<u32>(11u)));
            let e_82 = ((e_69 ^ (e_69 >> bitcast<u32>(19u))) ^ (e_75 ^ (e_75 >> bitcast<u32>(8u))));
            let e_90 = (bitcast<u32>((e_58 & tmp152_)) * 8u);
            root_buffer_0_.member[((8388688u + e_90) >> bitcast<u32>(2u))] = bitcast<i32>(((f32((e_69 * 1000000007u)) * 0.00000000023283064365386963) - tmp4_));
            root_buffer_0_.member[((e_90 + 8388692u) >> bitcast<u32>(2u))] = bitcast<i32>(((f32((e_82 * 1000000007u)) * 0.0000000006984919309616089) - tmp8_));
            phi_136_ = e_82;
            phi_135_ = e_69;
            phi_134_ = e_50;
            phi_133_ = e_52;
            phi_29_ = (e_58 + total_invocs);
        }
    }
    return;
}

[[stage(compute), workgroup_size(128, 1, 1)]]
fn main([[builtin(global_invocation_id)]] param: vec3<u32>) {
    global = param;
    main_1();
}

`;


/***/ }),

/***/ "./src/examples/taichi2_vortex_ring/init_tracers_c58_0_k0005_vk_t00.ts":
/*!*****************************************************************************!*\
  !*** ./src/examples/taichi2_vortex_ring/init_tracers_c58_0_k0005_vk_t00.ts ***!
  \*****************************************************************************/
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.shader = void 0;
exports.shader = `
[[block]]
struct type_7 {
    member: [[stride(4)]] array<i32>;
};

let tmp234_: u32 = 0u;

var<private> global: vec3<u32>;
[[group(0), binding(0)]]
var<storage, read_write> root_buffer_0_: type_7;

fn main_1() {
    let e_27 = global[tmp234_];
    if ((bitcast<i32>(e_27) == bitcast<i32>(tmp234_))) {
        root_buffer_0_.member[2097152u] = 0;
        root_buffer_0_.member[2097153u] = 1065353216;
        root_buffer_0_.member[2097154u] = 0;
        root_buffer_0_.member[2097155u] = -1082130432;
        root_buffer_0_.member[2097156u] = 0;
        root_buffer_0_.member[2097157u] = 1050253722;
        root_buffer_0_.member[2097158u] = 0;
        root_buffer_0_.member[2097159u] = -1097229926;
        root_buffer_0_.member[2097168u] = 1065353216;
        root_buffer_0_.member[2097169u] = -1082130432;
        root_buffer_0_.member[2097170u] = 1065353216;
        root_buffer_0_.member[2097171u] = -1082130432;
    }
    return;
}

[[stage(compute), workgroup_size(1, 1, 1)]]
fn main([[builtin(global_invocation_id)]] param: vec3<u32>) {
    global = param;
    main_1();
}

`;


/***/ }),

/***/ "./src/examples/taichi2_vortex_ring/integrate_vortex_c54_0_k0006_vk_t00.ts":
/*!*********************************************************************************!*\
  !*** ./src/examples/taichi2_vortex_ring/integrate_vortex_c54_0_k0006_vk_t00.ts ***!
  \*********************************************************************************/
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.shader = void 0;
exports.shader = `
[[block]]
struct type_8 {
    member: [[stride(4)]] array<i32>;
};

let totale_lems: i32 = 4;

let tmp1995_: u32 = 0u;

let total_invocs: i32 = 128;

let tmp2092_: i32 = 3;

let tmp1_: f32 = 1.0;

let tmp3_: f32 = 0.5;

let tmp4_: f32 = 3.1415927410125732;

let tmp5_: i32 = 1;

let tmp9_: i32 = 0;

let tmp10_: i32 = 4;

let tmp54_: f32 = 0.10000000149011612;

var<private> global: vec3<u32>;
[[group(0), binding(0)]]
var<storage, read_write> root_buffer_0_: type_8;

fn main_1() {
    var phi_29_: i32;
    var phi_180_: f32;
    var phi_179_: f32;
    var phi_48_: i32;
    var phi_182_: f32;
    var phi_181_: f32;
    var local: f32;
    var local_1: f32;
    var local_2: f32;
    var local_3: f32;

    let e_33 = global[tmp1995_];
    phi_29_ = bitcast<i32>(e_33);
    loop {
        let e_36 = phi_29_;
        if ((e_36 < totale_lems)) {
            phi_180_ = 0.0;
            phi_179_ = 0.0;
            phi_48_ = tmp9_;
            loop {
                let e_39 = phi_180_;
                let e_41 = phi_179_;
                let e_43 = phi_48_;
                local = e_41;
                local_1 = e_39;
                if ((e_43 < tmp10_)) {
                    if (((-(select(0, 1, (e_36 != e_43))) & tmp5_) != 0)) {
                        let e_52 = (bitcast<u32>((e_36 & tmp2092_)) * 8u);
                        let e_58 = root_buffer_0_.member[((8388608u + e_52) >> bitcast<u32>(2u))];
                        let e_65 = root_buffer_0_.member[((e_52 + 8388612u) >> bitcast<u32>(2u))];
                        let e_66 = bitcast<f32>(e_65);
                        let e_68 = bitcast<u32>((e_43 & tmp2092_));
                        let e_69 = (e_68 * 8u);
                        let e_75 = root_buffer_0_.member[((8388608u + e_69) >> bitcast<u32>(2u))];
                        let e_77 = (bitcast<f32>(e_58) - bitcast<f32>(e_75));
                        let e_83 = root_buffer_0_.member[((e_69 + 8388612u) >> bitcast<u32>(2u))];
                        let e_84 = bitcast<f32>(e_83);
                        let e_85 = (e_66 - e_84);
                        let e_89 = sqrt(((e_77 * e_77) + (e_85 * e_85)));
                        let e_90 = (e_89 * e_89);
                        let e_98 = root_buffer_0_.member[((8388672u + (e_68 * 4u)) >> bitcast<u32>(2u))];
                        let e_99 = bitcast<f32>(e_98);
                        let e_102 = (e_90 * tmp4_);
                        let e_109 = (tmp1_ - exp((e_90 * -10000.0)));
                        phi_182_ = (e_39 + ((((e_99 * e_77) / e_102) * tmp3_) * e_109));
                        phi_181_ = (e_41 + ((((e_99 * (e_84 - e_66)) / e_102) * tmp3_) * e_109));
                    } else {
                        phi_182_ = e_39;
                        phi_181_ = e_41;
                    }
                    let e_115 = phi_182_;
                    let e_117 = phi_181_;
                    local_2 = e_115;
                    local_3 = e_117;
                    continue;
                } else {
                    break;
                }
                continuing {
                    let e_160 = local_2;
                    phi_180_ = e_160;
                    let e_163 = local_3;
                    phi_179_ = e_163;
                    phi_48_ = (e_43 + 1);
                }
            }
            let e_120 = local;
            let e_123 = local_1;
            let e_127 = (bitcast<u32>((e_36 & tmp2092_)) * 8u);
            let e_133 = root_buffer_0_.member[((8388608u + e_127) >> bitcast<u32>(2u))];
            let e_141 = root_buffer_0_.member[((e_127 + 8388612u) >> bitcast<u32>(2u))];
            root_buffer_0_.member[((8388640u + e_127) >> bitcast<u32>(2u))] = bitcast<i32>((bitcast<f32>(e_133) + (e_120 * tmp54_)));
            root_buffer_0_.member[((e_127 + 8388644u) >> bitcast<u32>(2u))] = bitcast<i32>((bitcast<f32>(e_141) + (e_123 * tmp54_)));
            continue;
        } else {
            break;
        }
        continuing {
            phi_29_ = (e_36 + total_invocs);
        }
    }
    return;
}

[[stage(compute), workgroup_size(128, 1, 1)]]
fn main([[builtin(global_invocation_id)]] param: vec3<u32>) {
    global = param;
    main_1();
}

`;


/***/ }),

/***/ "./src/examples/taichi2_vortex_ring/integrate_vortex_c54_0_k0006_vk_t01.ts":
/*!*********************************************************************************!*\
  !*** ./src/examples/taichi2_vortex_ring/integrate_vortex_c54_0_k0006_vk_t01.ts ***!
  \*********************************************************************************/
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.shader = void 0;
exports.shader = `
[[block]]
struct type_8 {
    member: [[stride(4)]] array<i32>;
};

let begine_xpr_value: i32 = 0;

let totale_lems: i32 = 4;

let tmp2035_: u32 = 0u;

let total_invocs: i32 = 128;

let tmp2171_: i32 = 0;

let tmp2112_: i32 = 3;

var<private> global: vec3<u32>;
[[group(0), binding(0)]]
var<storage, read_write> root_buffer_0_: type_8;

fn main_1() {
    var phi_29_: i32;

    let e_24 = global[tmp2035_];
    phi_29_ = (bitcast<i32>(e_24) + begine_xpr_value);
    loop {
        let e_29 = phi_29_;
        if ((e_29 < (totale_lems + begine_xpr_value))) {
            let e_34 = (tmp2035_ + (bitcast<u32>(tmp2171_) * 10485840u));
            let e_36 = ((e_29 + 0) & tmp2112_);
            let e_39 = ((e_34 + 8388640u) + (bitcast<u32>(e_36) * 8u));
            let e_45 = root_buffer_0_.member[((e_39 + tmp2035_) >> bitcast<u32>(2u))];
            let e_50 = ((e_34 + 8388608u) + (bitcast<u32>(e_36) * 8u));
            root_buffer_0_.member[((e_50 + tmp2035_) >> bitcast<u32>(2u))] = bitcast<i32>(bitcast<f32>(e_45));
            let e_62 = root_buffer_0_.member[((e_39 + 4u) >> bitcast<u32>(2u))];
            root_buffer_0_.member[((e_50 + 4u) >> bitcast<u32>(2u))] = bitcast<i32>(bitcast<f32>(e_62));
            continue;
        } else {
            break;
        }
        continuing {
            phi_29_ = (e_29 + total_invocs);
        }
    }
    return;
}

[[stage(compute), workgroup_size(128, 1, 1)]]
fn main([[builtin(global_invocation_id)]] param: vec3<u32>) {
    global = param;
    main_1();
}

`;


/***/ }),

/***/ "./src/examples/taichi2_vortex_ring/main.ts":
/*!**************************************************!*\
  !*** ./src/examples/taichi2_vortex_ring/main.ts ***!
  \**************************************************/
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.taichiExample2VortexRing = void 0;
const init_tracers_c58_0_k0005_vk_t00_1 = __webpack_require__(/*! ./init_tracers_c58_0_k0005_vk_t00 */ "./src/examples/taichi2_vortex_ring/init_tracers_c58_0_k0005_vk_t00.ts");
const init_tracers_c58_0_k0003_vk_t00_1 = __webpack_require__(/*! ./init_tracers_c58_0_k0003_vk_t00 */ "./src/examples/taichi2_vortex_ring/init_tracers_c58_0_k0003_vk_t00.ts");
const advect_c56_0_k0005_vk_t00_1 = __webpack_require__(/*! ./advect_c56_0_k0005_vk_t00 */ "./src/examples/taichi2_vortex_ring/advect_c56_0_k0005_vk_t00.ts");
const integrate_vortex_c54_0_k0006_vk_t00_1 = __webpack_require__(/*! ./integrate_vortex_c54_0_k0006_vk_t00 */ "./src/examples/taichi2_vortex_ring/integrate_vortex_c54_0_k0006_vk_t00.ts");
const integrate_vortex_c54_0_k0006_vk_t01_1 = __webpack_require__(/*! ./integrate_vortex_c54_0_k0006_vk_t01 */ "./src/examples/taichi2_vortex_ring/integrate_vortex_c54_0_k0006_vk_t01.ts");
const paint_c60_0_k0008_vk_t00_1 = __webpack_require__(/*! ./paint_c60_0_k0008_vk_t00 */ "./src/examples/taichi2_vortex_ring/paint_c60_0_k0008_vk_t00.ts");
const paint_c60_0_k0008_vk_t01_1 = __webpack_require__(/*! ./paint_c60_0_k0008_vk_t01 */ "./src/examples/taichi2_vortex_ring/paint_c60_0_k0008_vk_t01.ts");
const Program_1 = __webpack_require__(/*! ../../program/Program */ "./src/program/Program.ts");
const FieldsFactory_1 = __webpack_require__(/*! ../../program/FieldsFactory */ "./src/program/FieldsFactory.ts");
let taichiExample2VortexRing = (canvas) => __awaiter(void 0, void 0, void 0, function* () {
    yield Program_1.program.materializeRuntime();
    let resolution = [512, 1024];
    let n_vortex = 4;
    let n_tracer = 200000;
    let image = FieldsFactory_1.Vector.field(4, resolution);
    let pos = FieldsFactory_1.Vector.field(2, [n_vortex]);
    let new_pos = FieldsFactory_1.Vector.field(2, [n_vortex]);
    let vort = (0, FieldsFactory_1.field)([n_vortex]);
    let tracer = FieldsFactory_1.Vector.field(2, [n_tracer]);
    Program_1.program.materializeCurrentTree();
    let initTracersKernel = Program_1.program.runtime.createKernel([
        {
            code: init_tracers_c58_0_k0005_vk_t00_1.shader,
            invocatoions: 1
        },
        {
            code: init_tracers_c58_0_k0003_vk_t00_1.shader,
            invocatoions: n_tracer
        }
    ]);
    let advectKernel = Program_1.program.runtime.createKernel([
        {
            code: advect_c56_0_k0005_vk_t00_1.shader,
            invocatoions: n_tracer
        }
    ]);
    let integrateVortexKernel = Program_1.program.runtime.createKernel([
        {
            code: integrate_vortex_c54_0_k0006_vk_t00_1.shader,
            invocatoions: n_vortex
        },
        {
            code: integrate_vortex_c54_0_k0006_vk_t01_1.shader,
            invocatoions: n_vortex
        }
    ]);
    let paintKernel = Program_1.program.runtime.createKernel([
        {
            code: paint_c60_0_k0008_vk_t00_1.shader,
            invocatoions: resolution[0] * resolution[1]
        },
        {
            code: paint_c60_0_k0008_vk_t01_1.shader,
            invocatoions: resolution[0] * resolution[1]
        }
    ]);
    let renderer = yield Program_1.program.runtime.getRootBufferRenderer(canvas);
    Program_1.program.runtime.launchKernel(initTracersKernel);
    function frame() {
        return __awaiter(this, void 0, void 0, function* () {
            for (let i = 0; i < 4; ++i) {
                Program_1.program.runtime.launchKernel(advectKernel);
                Program_1.program.runtime.launchKernel(integrateVortexKernel);
            }
            Program_1.program.runtime.launchKernel(paintKernel);
            yield Program_1.program.runtime.sync();
            yield renderer.render(1024, 512);
            console.log("done");
            requestAnimationFrame(frame);
        });
    }
    requestAnimationFrame(frame);
});
exports.taichiExample2VortexRing = taichiExample2VortexRing;


/***/ }),

/***/ "./src/examples/taichi2_vortex_ring/paint_c60_0_k0008_vk_t00.ts":
/*!**********************************************************************!*\
  !*** ./src/examples/taichi2_vortex_ring/paint_c60_0_k0008_vk_t00.ts ***!
  \**********************************************************************/
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.shader = void 0;
exports.shader = `
[[block]]
struct type_7 {
    member: [[stride(4)]] array<i32>;
};

let totale_lems: i32 = 524288;

let tmp2396_: u32 = 0u;

let total_invocs: i32 = 524288;

let tmp2510_: i32 = 9;

let tmp2674_: i32 = 1023;

let tmp2675_: i32 = 511;

var<private> global: vec3<u32>;
[[group(0), binding(0)]]
var<storage, read_write> root_buffer_0_: type_7;

fn main_1() {
    var phi_29_: i32;

    let e_23 = global[tmp2396_];
    phi_29_ = bitcast<i32>(e_23);
    loop {
        let e_26 = phi_29_;
        if ((e_26 < totale_lems)) {
            continue;
        } else {
            break;
        }
        continuing {
            let e_36 = (bitcast<u32>(((e_26 & tmp2675_) + (((e_26 >> bitcast<u32>(tmp2510_)) & tmp2674_) << bitcast<u32>(tmp2510_)))) * 16u);
            root_buffer_0_.member[(e_36 >> bitcast<u32>(2u))] = 1065353216;
            root_buffer_0_.member[((e_36 + 4u) >> bitcast<u32>(2u))] = 1065353216;
            root_buffer_0_.member[((e_36 + 8u) >> bitcast<u32>(2u))] = 1065353216;
            root_buffer_0_.member[((e_36 + 12u) >> bitcast<u32>(2u))] = 1065353216;
            phi_29_ = (e_26 + total_invocs);
        }
    }
    return;
}

[[stage(compute), workgroup_size(128, 1, 1)]]
fn main([[builtin(global_invocation_id)]] param: vec3<u32>) {
    global = param;
    main_1();
}

`;


/***/ }),

/***/ "./src/examples/taichi2_vortex_ring/paint_c60_0_k0008_vk_t01.ts":
/*!**********************************************************************!*\
  !*** ./src/examples/taichi2_vortex_ring/paint_c60_0_k0008_vk_t01.ts ***!
  \**********************************************************************/
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.shader = void 0;
exports.shader = `
[[block]]
struct type_8 {
    member: [[stride(4)]] array<i32>;
};

let begine_xpr_value: i32 = 0;

let totale_lems: i32 = 200000;

let tmp2443_: u32 = 0u;

let total_invocs: i32 = 200064;

let tmp2622_: i32 = 0;

let tmp2552_: i32 = 262143;

let tmp28_: f32 = 0.10000000149011612;

let tmp30_: f32 = 0.5;

let tmp32_: f32 = 51.20000076293945;

let tmp34_: f32 = 512.0;

let tmp39_: f32 = 0.0;

let tmp2560_: i32 = 1023;

let tmp2564_: i32 = 511;

let tmp2678_: i32 = 9;

let tmp46_: f32 = 1.0;

var<private> global: vec3<u32>;
[[group(0), binding(0)]]
var<storage, read_write> root_buffer_0_: type_8;

fn main_1() {
    var phi_29_: i32;

    let e_34 = global[tmp2443_];
    phi_29_ = (bitcast<i32>(e_34) + begine_xpr_value);
    loop {
        let e_39 = phi_29_;
        if ((e_39 < (totale_lems + begine_xpr_value))) {
            let e_44 = (tmp2443_ + (bitcast<u32>(tmp2622_) * 10485840u));
            let e_49 = ((e_44 + 8388688u) + (bitcast<u32>(((e_39 + 0) & tmp2552_)) * 8u));
            let e_55 = root_buffer_0_.member[((e_49 + tmp2443_) >> bitcast<u32>(2u))];
            let e_62 = root_buffer_0_.member[((e_49 + 4u) >> bitcast<u32>(2u))];
            let e_78 = ((e_44 + tmp2443_) + (bitcast<u32>(((i32((((bitcast<f32>(e_62) * tmp28_) + tmp30_) * tmp34_)) & tmp2564_) + ((i32((bitcast<f32>(e_55) * tmp32_)) & tmp2560_) << bitcast<u32>(tmp2678_)))) * 16u));
            root_buffer_0_.member[((e_78 + tmp2443_) >> bitcast<u32>(2u))] = bitcast<i32>(tmp39_);
            root_buffer_0_.member[((e_78 + 4u) >> bitcast<u32>(2u))] = bitcast<i32>(tmp39_);
            root_buffer_0_.member[((e_78 + 8u) >> bitcast<u32>(2u))] = bitcast<i32>(tmp39_);
            root_buffer_0_.member[((e_78 + 12u) >> bitcast<u32>(2u))] = bitcast<i32>(tmp46_);
            continue;
        } else {
            break;
        }
        continuing {
            phi_29_ = (e_39 + total_invocs);
        }
    }
    return;
}

[[stage(compute), workgroup_size(128, 1, 1)]]
fn main([[builtin(global_invocation_id)]] param: vec3<u32>) {
    global = param;
    main_1();
}

`;


/***/ }),

/***/ "./src/examples/triangle/main.ts":
/*!***************************************!*\
  !*** ./src/examples/triangle/main.ts ***!
  \***************************************/
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.triangle = void 0;
const shader_vert_wgsl_1 = __webpack_require__(/*! ./shader.vert.wgsl */ "./src/examples/triangle/shader.vert.wgsl.ts");
const shader_frag_wgsl_1 = __webpack_require__(/*! ./shader.frag.wgsl */ "./src/examples/triangle/shader.frag.wgsl.ts");
let triangle = (canvas) => __awaiter(void 0, void 0, void 0, function* () {
    const context = canvas.getContext('webgpu');
    const adapter = yield navigator.gpu.requestAdapter();
    const device = yield adapter.requestDevice();
    const presentationFormat = context.getPreferredFormat(adapter);
    const primitiveType = 'triangle-list';
    context.configure({
        device,
        format: presentationFormat,
    });
    const triangleWidth = 1;
    const triangleHeight = 1;
    // prettier-ignore
    const vertices = new Float32Array([
        0.0, triangleHeight / 2,
        triangleWidth / 2, -triangleHeight / 2,
        -triangleWidth / 2, -triangleHeight / 2,
    ]);
    const vertexBuffer = device.createBuffer({
        size: vertices.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        mappedAtCreation: true,
    });
    new Float32Array(vertexBuffer.getMappedRange()).set(vertices);
    vertexBuffer.unmap();
    // prettier-ignore
    const colors = new Float32Array([
        1.0, 0.0, 0.0,
        0.0, 1.0, 0.0,
        0.0, 0.0, 1.0
    ]);
    const colorsBuffer = device.createBuffer({
        size: colors.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        mappedAtCreation: true,
    });
    new Float32Array(colorsBuffer.getMappedRange()).set(colors);
    colorsBuffer.unmap();
    const pipeline = device.createRenderPipeline({
        vertex: {
            module: device.createShaderModule({
                code: shader_vert_wgsl_1.shader,
            }),
            entryPoint: 'main',
            buffers: [
                {
                    arrayStride: 2 * Float32Array.BYTES_PER_ELEMENT,
                    attributes: [
                        {
                            shaderLocation: 0,
                            format: 'float32x2',
                            offset: 0,
                        },
                    ],
                },
                {
                    arrayStride: 3 * Float32Array.BYTES_PER_ELEMENT,
                    attributes: [
                        {
                            shaderLocation: 1,
                            format: 'float32x3',
                            offset: 0,
                        },
                    ],
                },
            ],
        },
        fragment: {
            module: device.createShaderModule({
                code: shader_frag_wgsl_1.shader,
            }),
            entryPoint: 'main',
            targets: [
                {
                    format: presentationFormat,
                },
            ],
        },
        primitive: {
            topology: primitiveType,
            stripIndexFormat: undefined,
        },
    });
    const commandEncoder = device.createCommandEncoder();
    const textureView = context.getCurrentTexture().createView();
    const renderPass = commandEncoder.beginRenderPass({
        colorAttachments: [
            {
                view: textureView,
                loadValue: [0.1, 0.1, 0.1, 1.0],
                storeOp: 'store',
            },
        ],
    });
    renderPass.setPipeline(pipeline);
    renderPass.setVertexBuffer(0, vertexBuffer);
    renderPass.setVertexBuffer(1, colorsBuffer);
    renderPass.draw(3);
    renderPass.endPass();
    device.queue.submit([commandEncoder.finish()]);
});
exports.triangle = triangle;


/***/ }),

/***/ "./src/examples/triangle/shader.frag.wgsl.ts":
/*!***************************************************!*\
  !*** ./src/examples/triangle/shader.frag.wgsl.ts ***!
  \***************************************************/
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.shader = void 0;
exports.shader = `
struct Input {
  [[location(0)]] vColor: vec3<f32>;
};

[[stage(fragment)]]

fn main (input: Input) -> [[location(0)]] vec4<f32> {
  return vec4<f32>(input.vColor, 1.0);
}
`;


/***/ }),

/***/ "./src/examples/triangle/shader.vert.wgsl.ts":
/*!***************************************************!*\
  !*** ./src/examples/triangle/shader.vert.wgsl.ts ***!
  \***************************************************/
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.shader = void 0;
exports.shader = `

struct Input {
  [[location(0)]] position: vec4<f32>;
  [[location(1)]] color: vec3<f32>;
};

struct Output {
  [[builtin(position)]] Position : vec4<f32>;
  [[location(0)]] vColor: vec3<f32>;
};

[[stage(vertex)]]

fn main (input: Input) -> Output {
  var output: Output;
  
  output.Position = input.position;

  output.vColor = input.color;
  return output;
}
`;


/***/ }),

/***/ "./src/program/FieldsFactory.ts":
/*!**************************************!*\
  !*** ./src/program/FieldsFactory.ts ***!
  \**************************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.Matrix = exports.Vector = exports.field = void 0;
const Program_1 = __webpack_require__(/*! ./Program */ "./src/program/Program.ts");
function product(dimensions) {
    let size = 1;
    for (let d of dimensions) {
        size = size * d;
    }
    return size;
}
function field(dimensions) {
    let size = 4 * product(dimensions);
    return Program_1.program.partialTree.addField(size);
}
exports.field = field;
let Vector = {
    field: (n, dimensions) => {
        let size = 4 * n * product(dimensions);
        return Program_1.program.partialTree.addField(size);
    }
};
exports.Vector = Vector;
let Matrix = {
    field: (m, n, dimensions) => {
        let size = 4 * n * m * product(dimensions);
        return Program_1.program.partialTree.addField(size);
    }
};
exports.Matrix = Matrix;


/***/ }),

/***/ "./src/program/Program.ts":
/*!********************************!*\
  !*** ./src/program/Program.ts ***!
  \********************************/
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.program = exports.Program = void 0;
const Runtime_1 = __webpack_require__(/*! ../backend/Runtime */ "./src/backend/Runtime.ts");
const SNodeTree_1 = __webpack_require__(/*! ./SNodeTree */ "./src/program/SNodeTree.ts");
class Program {
    constructor() {
        this.runtime = null;
        this.materializedTrees = [];
        this.partialTree = new SNodeTree_1.SNodeTree();
        this.partialTree.treeId = 0;
    }
    materializeRuntime() {
        return __awaiter(this, void 0, void 0, function* () {
            this.runtime = new Runtime_1.Runtime();
            yield this.runtime.init();
        });
    }
    materializeCurrentTree() {
        if (this.partialTree.size === 0) {
            return;
        }
        if (this.runtime == null) {
            this.materializeRuntime();
        }
        this.runtime.materializeTree(this.partialTree);
        this.materializedTrees.push(this.partialTree);
        let nextId = this.partialTree.treeId + 1;
        this.partialTree = new SNodeTree_1.SNodeTree();
        this.partialTree.treeId = nextId;
    }
}
exports.Program = Program;
const program = new Program();
exports.program = program;


/***/ }),

/***/ "./src/program/SNodeTree.ts":
/*!**********************************!*\
  !*** ./src/program/SNodeTree.ts ***!
  \**********************************/
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.SNodeTree = void 0;
class SNodeTree {
    constructor() {
        this.treeId = 0;
        this.fields = [];
        this.size = 0;
    }
    addField(fieldSize) {
        let field = {
            snodeTree: this,
            offset: this.size,
            size: fieldSize
        };
        this.size += fieldSize;
        this.fields.push(field);
        return field;
    }
}
exports.SNodeTree = SNodeTree;


/***/ }),

/***/ "./src/taichi.ts":
/*!***********************!*\
  !*** ./src/taichi.ts ***!
  \***********************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.taichi = void 0;
const main_1 = __webpack_require__(/*! ./examples/triangle/main */ "./src/examples/triangle/main.ts");
const main_2 = __webpack_require__(/*! ./examples/computeBoids/main */ "./src/examples/computeBoids/main.ts");
const main_3 = __webpack_require__(/*! ./examples/taichi0/main */ "./src/examples/taichi0/main.ts");
const main_4 = __webpack_require__(/*! ./examples/taichi1/main */ "./src/examples/taichi1/main.ts");
const main_5 = __webpack_require__(/*! ./examples/taichi2_vortex_ring/main */ "./src/examples/taichi2_vortex_ring/main.ts");
function kernel(f) {
    console.log(f.toString());
}
const taichi = {
    kernel,
    triangle: main_1.triangle,
    computeBoids: main_2.computeBoids,
    taichiExample0: main_3.taichiExample0,
    taichiExample1: main_4.taichiExample1,
    taichiExample2VortexRing: main_5.taichiExample2VortexRing
};
exports.taichi = taichi;


/***/ }),

/***/ "./src/utils/Utils.ts":
/*!****************************!*\
  !*** ./src/utils/Utils.ts ***!
  \****************************/
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.divUp = void 0;
function divUp(a, b) {
    return Math.ceil(a / b);
}
exports.divUp = divUp;


/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry need to be wrapped in an IIFE because it need to be isolated against other modules in the chunk.
(() => {
var exports = __webpack_exports__;
/*!*******************!*\
  !*** ./src/ti.ts ***!
  \*******************/

Object.defineProperty(exports, "__esModule", ({ value: true }));
const taichi_1 = __webpack_require__(/*! ./taichi */ "./src/taichi.ts");
globalThis.taichi = taichi_1.taichi;

})();

/******/ })()
;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,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O0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLGtCQUFrQjtBQUNsQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLGtCQUFrQjtBQUNsQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0Esa0JBQWtCO0FBQ2xCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFVBQVU7QUFDVjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7Ozs7Ozs7Ozs7QUNuTmE7QUFDYiw4Q0FBNkMsRUFBRSxhQUFhLEVBQUM7QUFDN0QsY0FBYztBQUNkLGNBQWM7QUFDZDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxVQUFVO0FBQ1Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7Ozs7Ozs7OztBQy9FYTtBQUNiLDhDQUE2QyxFQUFFLGFBQWEsRUFBQztBQUM3RCxjQUFjO0FBQ2QsY0FBYztBQUNkO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7Ozs7Ozs7OztBQ3hDYTtBQUNiLDhDQUE2QyxFQUFFLGFBQWEsRUFBQztBQUM3RCxjQUFjO0FBQ2QsY0FBYztBQUNkO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLHNCQUFzQjtBQUN0QjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0Esa0JBQWtCO0FBQ2xCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFVBQVU7QUFDVjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7Ozs7Ozs7Ozs7QUM5SGE7QUFDYiw4Q0FBNkMsRUFBRSxhQUFhLEVBQUM7QUFDN0QsY0FBYztBQUNkLGNBQWM7QUFDZDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsVUFBVTtBQUNWO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFD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Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLGlCQUFpQjs7Ozs7Ozs7Ozs7QUNwQko7QUFDYiw4Q0FBNkMsRUFBRSxhQUFhLEVBQUM7QUFDN0QsY0FBYztBQUNkLGVBQWUsbUJBQU8sQ0FBQyxpRUFBMEI7QUFDakQsZUFBZSxtQkFBTyxDQUFDLHlFQUE4QjtBQUNyRCxlQUFlLG1CQUFPLENBQUMsK0RBQXlCO0FBQ2hELGVBQWUsbUJBQU8sQ0FBQywrREFBeUI7QUFDaEQsZUFBZSxtQkFBTyxDQUFDLHVGQUFxQztBQUM1RDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsY0FBYzs7Ozs7Ozs7Ozs7QUNuQkQ7QUFDYiw4Q0FBNkMsRUFBRSxhQUFhLEVBQUM7QUFDN0QsYUFBYTtBQUNiO0FBQ0E7QUFDQTtBQUNBLGFBQWE7Ozs7Ozs7VUNOYjtVQUNBOztVQUVBO1VBQ0E7VUFDQTtVQUNBO1VBQ0E7VUFDQTtVQUNBO1VBQ0E7VUFDQTtVQUNBO1VBQ0E7VUFDQTtVQUNBOztVQUVBO1VBQ0E7O1VBRUE7VUFDQTtVQUNBOzs7Ozs7Ozs7O0FDdEJhO0FBQ2IsOENBQTZDLEVBQUUsYUFBYSxFQUFDO0FBQzdELGlCQUFpQixtQkFBTyxDQUFDLGlDQUFVO0FBQ25DIiwic291cmNlcyI6WyJ3ZWJwYWNrOi8vdGkuanMvLi9zcmMvYmFja2VuZC9LZXJuZWwudHMiLCJ3ZWJwYWNrOi8vdGkuanMvLi9zcmMvYmFja2VuZC9SZW5kZXJSb290QnVmZmVyLnRzIiwid2VicGFjazovL3RpLmpzLy4vc3JjL2JhY2tlbmQvUnVudGltZS50cyIsIndlYnBhY2s6Ly90aS5qcy8uL3NyYy9leGFtcGxlcy9jb21wdXRlQm9pZHMvbWFpbi50cyIsIndlYnBhY2s6Ly90aS5qcy8uL3NyYy9leGFtcGxlcy9jb21wdXRlQm9pZHMvc3ByaXRlLndnc2wudHMiLCJ3ZWJwYWNrOi8vdGkuanMvLi9zcmMvZXhhbXBsZXMvY29tcHV0ZUJvaWRzL3VwZGF0ZVNwcml0ZXMud2dzbC50cyIsIndlYnBhY2s6Ly90aS5qcy8uL3NyYy9leGFtcGxlcy90YWljaGkwL2luaXQwLndnc2wudHMiLCJ3ZWJwYWNrOi8vdGkuanMvLi9zcmMvZXhhbXBsZXMvdGFpY2hpMC9tYWluLnRzIiwid2VicGFjazovL3RpLmpzLy4vc3JjL2V4YW1wbGVzL3RhaWNoaTEvaW5pdDAud2dzbC50cyIsIndlYnBhY2s6Ly90aS5qcy8uL3NyYy9leGFtcGxlcy90YWljaGkxL21haW4udHMiLCJ3ZWJwYWNrOi8vdGkuanMvLi9zcmMvZXhhbXBsZXMvdGFpY2hpMl92b3J0ZXhfcmluZy9hZHZlY3RfYzU2XzBfazAwMDVfdmtfdDAwLnRzIiwid2VicGFjazovL3RpLmpzLy4vc3JjL2V4YW1wbGVzL3RhaWNoaTJfdm9ydGV4X3JpbmcvaW5pdF90cmFjZXJzX2M1OF8wX2swMDAzX3ZrX3QwMC50cyIsIndlYnBhY2s6Ly90aS5qcy8uL3NyYy9leGFtcGxlcy90YWljaGkyX3ZvcnRleF9yaW5nL2luaXRfdHJhY2Vyc19jNThfMF9rMDAwNV92a190MDAudHMiLCJ3ZWJwYWNrOi8vdGkuanMvLi9zcmMvZXhhbXBsZXMvdGFpY2hpMl92b3J0ZXhfcmluZy9pbnRlZ3JhdGVfdm9ydGV4X2M1NF8wX2swMDA2X3ZrX3QwMC50cyIsIndlYnBhY2s6Ly90aS5qcy8uL3NyYy9leGFtcGxlcy90YWljaGkyX3ZvcnRleF9yaW5nL2ludGVncmF0ZV92b3J0ZXhfYzU0XzBfazAwMDZfdmtfdDAxLnRzIiwid2VicGFjazovL3RpLmpzLy4vc3JjL2V4YW1wbGVzL3RhaWNoaTJfdm9ydGV4X3JpbmcvbWFpbi50cyIsIndlYnBhY2s6Ly90aS5qcy8uL3NyYy9leGFtcGxlcy90YWljaGkyX3ZvcnRleF9yaW5nL3BhaW50X2M2MF8wX2swMDA4X3ZrX3QwMC50cyIsIndlYnBhY2s6Ly90aS5qcy8uL3NyYy9leGFtcGxlcy90YWljaGkyX3ZvcnRleF9yaW5nL3BhaW50X2M2MF8wX2swMDA4X3ZrX3QwMS50cyIsIndlYnBhY2s6Ly90aS5qcy8uL3NyYy9leGFtcGxlcy90cmlhbmdsZS9tYWluLnRzIiwid2VicGFjazovL3RpLmpzLy4vc3JjL2V4YW1wbGVzL3RyaWFuZ2xlL3NoYWRlci5mcmFnLndnc2wudHMiLCJ3ZWJwYWNrOi8vdGkuanMvLi9zcmMvZXhhbXBsZXMvdHJpYW5nbGUvc2hhZGVyLnZlcnQud2dzbC50cyIsIndlYnBhY2s6Ly90aS5qcy8uL3NyYy9wcm9ncmFtL0ZpZWxkc0ZhY3RvcnkudHMiLCJ3ZWJwYWNrOi8vdGkuanMvLi9zcmMvcHJvZ3JhbS9Qcm9ncmFtLnRzIiwid2VicGFjazovL3RpLmpzLy4vc3JjL3Byb2dyYW0vU05vZGVUcmVlLnRzIiwid2VicGFjazovL3RpLmpzLy4vc3JjL3RhaWNoaS50cyIsIndlYnBhY2s6Ly90aS5qcy8uL3NyYy91dGlscy9VdGlscy50cyIsIndlYnBhY2s6Ly90aS5qcy93ZWJwYWNrL2Jvb3RzdHJhcCIsIndlYnBhY2s6Ly90aS5qcy8uL3NyYy90aS50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJcInVzZSBzdHJpY3RcIjtcclxuT2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFwiX19lc01vZHVsZVwiLCB7IHZhbHVlOiB0cnVlIH0pO1xyXG5leHBvcnRzLlRhc2tQYXJhbXMgPSBleHBvcnRzLkNvbXBpbGVkS2VybmVsID0gZXhwb3J0cy5Db21waWxlZFRhc2sgPSB2b2lkIDA7XHJcbmNsYXNzIFRhc2tQYXJhbXMge1xyXG4gICAgY29uc3RydWN0b3IoKSB7XHJcbiAgICAgICAgdGhpcy5jb2RlID0gXCJcIjtcclxuICAgICAgICB0aGlzLmludm9jYXRvaW9ucyA9IDA7XHJcbiAgICB9XHJcbn1cclxuZXhwb3J0cy5UYXNrUGFyYW1zID0gVGFza1BhcmFtcztcclxuY2xhc3MgQ29tcGlsZWRUYXNrIHtcclxuICAgIGNvbnN0cnVjdG9yKGRldmljZSwgcGFyYW1zKSB7XHJcbiAgICAgICAgdGhpcy5waXBlbGluZSA9IG51bGw7XHJcbiAgICAgICAgdGhpcy5iaW5kR3JvdXAgPSBudWxsO1xyXG4gICAgICAgIHRoaXMuZGV2aWNlID0gZGV2aWNlO1xyXG4gICAgICAgIHRoaXMucGFyYW1zID0gcGFyYW1zO1xyXG4gICAgICAgIHRoaXMuY3JlYXRlUGlwZWxpbmUoKTtcclxuICAgIH1cclxuICAgIGNyZWF0ZVBpcGVsaW5lKCkge1xyXG4gICAgICAgIHRoaXMucGlwZWxpbmUgPSB0aGlzLmRldmljZS5jcmVhdGVDb21wdXRlUGlwZWxpbmUoe1xyXG4gICAgICAgICAgICBjb21wdXRlOiB7XHJcbiAgICAgICAgICAgICAgICBtb2R1bGU6IHRoaXMuZGV2aWNlLmNyZWF0ZVNoYWRlck1vZHVsZSh7XHJcbiAgICAgICAgICAgICAgICAgICAgY29kZTogdGhpcy5wYXJhbXMuY29kZSxcclxuICAgICAgICAgICAgICAgIH0pLFxyXG4gICAgICAgICAgICAgICAgZW50cnlQb2ludDogJ21haW4nLFxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG59XHJcbmV4cG9ydHMuQ29tcGlsZWRUYXNrID0gQ29tcGlsZWRUYXNrO1xyXG5jbGFzcyBDb21waWxlZEtlcm5lbCB7XHJcbiAgICBjb25zdHJ1Y3RvcihkZXZpY2UpIHtcclxuICAgICAgICB0aGlzLnRhc2tzID0gW107XHJcbiAgICAgICAgdGhpcy5kZXZpY2UgPSBkZXZpY2U7XHJcbiAgICB9XHJcbn1cclxuZXhwb3J0cy5Db21waWxlZEtlcm5lbCA9IENvbXBpbGVkS2VybmVsO1xyXG4iLCJcInVzZSBzdHJpY3RcIjtcclxudmFyIF9fYXdhaXRlciA9ICh0aGlzICYmIHRoaXMuX19hd2FpdGVyKSB8fCBmdW5jdGlvbiAodGhpc0FyZywgX2FyZ3VtZW50cywgUCwgZ2VuZXJhdG9yKSB7XHJcbiAgICBmdW5jdGlvbiBhZG9wdCh2YWx1ZSkgeyByZXR1cm4gdmFsdWUgaW5zdGFuY2VvZiBQID8gdmFsdWUgOiBuZXcgUChmdW5jdGlvbiAocmVzb2x2ZSkgeyByZXNvbHZlKHZhbHVlKTsgfSk7IH1cclxuICAgIHJldHVybiBuZXcgKFAgfHwgKFAgPSBQcm9taXNlKSkoZnVuY3Rpb24gKHJlc29sdmUsIHJlamVjdCkge1xyXG4gICAgICAgIGZ1bmN0aW9uIGZ1bGZpbGxlZCh2YWx1ZSkgeyB0cnkgeyBzdGVwKGdlbmVyYXRvci5uZXh0KHZhbHVlKSk7IH0gY2F0Y2ggKGUpIHsgcmVqZWN0KGUpOyB9IH1cclxuICAgICAgICBmdW5jdGlvbiByZWplY3RlZCh2YWx1ZSkgeyB0cnkgeyBzdGVwKGdlbmVyYXRvcltcInRocm93XCJdKHZhbHVlKSk7IH0gY2F0Y2ggKGUpIHsgcmVqZWN0KGUpOyB9IH1cclxuICAgICAgICBmdW5jdGlvbiBzdGVwKHJlc3VsdCkgeyByZXN1bHQuZG9uZSA/IHJlc29sdmUocmVzdWx0LnZhbHVlKSA6IGFkb3B0KHJlc3VsdC52YWx1ZSkudGhlbihmdWxmaWxsZWQsIHJlamVjdGVkKTsgfVxyXG4gICAgICAgIHN0ZXAoKGdlbmVyYXRvciA9IGdlbmVyYXRvci5hcHBseSh0aGlzQXJnLCBfYXJndW1lbnRzIHx8IFtdKSkubmV4dCgpKTtcclxuICAgIH0pO1xyXG59O1xyXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgXCJfX2VzTW9kdWxlXCIsIHsgdmFsdWU6IHRydWUgfSk7XHJcbmV4cG9ydHMuUm9vdEJ1ZmZlclJlbmRlcmVyID0gZXhwb3J0cy5mcmFnU2hhZGVyID0gdm9pZCAwO1xyXG5jb25zdCB2ZXJ0U2hhZGVyID0gYFxyXG5zdHJ1Y3QgSW5wdXQge1xyXG4gIFtbbG9jYXRpb24oMCldXSBwb3NpdGlvbjogdmVjMjxmMzI+O1xyXG59O1xyXG5cclxuc3RydWN0IE91dHB1dCB7XHJcbiAgW1tidWlsdGluKHBvc2l0aW9uKV1dIFBvc2l0aW9uIDogdmVjNDxmMzI+O1xyXG4gIFtbbG9jYXRpb24oNSldXSBmcmFnUG9zOiB2ZWMyPGYzMj47XHJcbn07XHJcblxyXG5bW3N0YWdlKHZlcnRleCldXVxyXG5cclxuZm4gbWFpbiAoaW5wdXQ6IElucHV0KSAtPiBPdXRwdXQge1xyXG4gIHZhciBvdXRwdXQ6IE91dHB1dDtcclxuICBcclxuICBvdXRwdXQuUG9zaXRpb24gPSB2ZWM0PGYzMj4oaW5wdXQucG9zaXRpb24sMC4wLDEuMCk7XHJcbiAgb3V0cHV0LmZyYWdQb3MgPSB2ZWMyPGYzMj4oaW5wdXQucG9zaXRpb24pIDtcclxuICByZXR1cm4gb3V0cHV0O1xyXG59XHJcbmA7XHJcbmV4cG9ydHMuZnJhZ1NoYWRlciA9IGBcclxuc3RydWN0IElucHV0IHtcclxuICBbW2xvY2F0aW9uKDUpXV0gZnJhZ1BvczogdmVjMjxmMzI+O1xyXG59O1xyXG5cclxuW1tibG9ja11dXHJcbnN0cnVjdCBSb290QnVmZmVyVHlwZSB7XHJcbiAgICBtZW1iZXI6IFtbc3RyaWRlKDQpXV0gYXJyYXk8ZjMyPjtcclxufTtcclxuW1tncm91cCgwKSwgYmluZGluZygwKV1dXHJcbnZhcjxzdG9yYWdlLCByZWFkX3dyaXRlPiByb290QnVmZmVyOiBSb290QnVmZmVyVHlwZTtcclxuXHJcbltbYmxvY2tdXVxyXG5zdHJ1Y3QgVW5pZm9ybUJ1ZmZlclR5cGUge1xyXG4gIHdpZHRoIDogaTMyO1xyXG4gIGhlaWdodCA6IGkzMjtcclxufTtcclxuW1tiaW5kaW5nKDEpLCBncm91cCgwKV1dIFxyXG52YXI8dW5pZm9ybT4gdWJvIDogVW5pZm9ybUJ1ZmZlclR5cGU7XHJcblxyXG5cclxuW1tzdGFnZShmcmFnbWVudCldXVxyXG5cclxuZm4gbWFpbiAoaW5wdXQ6IElucHV0KSAtPiBbW2xvY2F0aW9uKDApXV0gdmVjNDxmMzI+IHtcclxuICAgIHZhciBmcmFnUG9zID0gaW5wdXQuZnJhZ1BvcztcclxuICAgIGZyYWdQb3MgPSAoZnJhZ1BvcyArIDEuMCApIC8gMi4wIDtcclxuICAgIGlmKGZyYWdQb3MueCA9PSBmcmFnUG9zLnkgKiAxMjM0NTYuMCl7XHJcbiAgICAgIHJldHVybiB2ZWM0PGYzMj4oZjMyKHViby53aWR0aCksZjMyKHViby5oZWlnaHQpLGYzMihyb290QnVmZmVyLm1lbWJlclswXSksIDEuMCk7XHJcbiAgICB9XHJcbiAgICB2YXIgd29ya2luZyA9IHZlYzQ8ZjMyPihmcmFnUG9zLDAuMCwgMS4wKTtcclxuXHJcbiAgICB2YXIgY2VsbFBvcyA9IHZlYzI8aTMyPihpMzIoZnJhZ1Bvcy54KmYzMih1Ym8ud2lkdGgpKSwgaTMyKGZyYWdQb3MueSpmMzIodWJvLmhlaWdodCkpKTtcclxuICAgIHZhciBwaXhlbEluZGV4ID0gY2VsbFBvcy54ICogdWJvLmhlaWdodCArIGNlbGxQb3MueTtcclxuICAgIC8vcGl4ZWxJbmRleCA9IGNlbGxQb3MueSAqIHViby53aWR0aCArIGNlbGxQb3MueDtcclxuICAgIHZhciByZXN1bHQgPSB2ZWM0PGYzMj4oXHJcbiAgICAgICAgKHJvb3RCdWZmZXIubWVtYmVyW3BpeGVsSW5kZXggKiA0ICsgMF0pLFxyXG4gICAgICAgIChyb290QnVmZmVyLm1lbWJlcltwaXhlbEluZGV4ICogNCArIDFdKSxcclxuICAgICAgICAocm9vdEJ1ZmZlci5tZW1iZXJbcGl4ZWxJbmRleCAqIDQgKyAyXSksXHJcbiAgICAgICAgKHJvb3RCdWZmZXIubWVtYmVyW3BpeGVsSW5kZXggKiA0ICsgM10pXHJcbiAgICApO1xyXG5cclxuICAgIC8vcmVzdWx0ID0gdmVjNDxmMzI+KGYzMihwaXhlbEluZGV4KS81MDAwMDAuMCwgMC4wLDAuMCwgMS4wKTsvLyArIDAuMDEgKiByZXN1bHQgLyAocmVzdWx0ICsgMC4wMSk7XHJcblxyXG4gICAgLy9yZXN1bHQgPSB3b3JraW5nO1xyXG4gICAgcmV0dXJuIHJlc3VsdDtcclxufVxyXG5gO1xyXG5jbGFzcyBSb290QnVmZmVyUmVuZGVyZXIge1xyXG4gICAgY29uc3RydWN0b3IoYWRhcHRlciwgZGV2aWNlLCBidWZmZXIpIHtcclxuICAgICAgICB0aGlzLmNvbnRleHQgPSBudWxsO1xyXG4gICAgICAgIHRoaXMudmVydGV4QnVmZmVyID0gbnVsbDtcclxuICAgICAgICB0aGlzLnVuaWZvcm1CdWZmZXIgPSBudWxsO1xyXG4gICAgICAgIHRoaXMucGlwZWxpbmUgPSBudWxsO1xyXG4gICAgICAgIHRoaXMucHJlc2VudGF0aW9uRm9ybWF0ID0gbnVsbDtcclxuICAgICAgICB0aGlzLmJpbmRHcm91cCA9IG51bGw7XHJcbiAgICAgICAgdGhpcy5hZGFwdGVyID0gYWRhcHRlcjtcclxuICAgICAgICB0aGlzLmRldmljZSA9IGRldmljZTtcclxuICAgICAgICB0aGlzLmJ1ZmZlciA9IGJ1ZmZlcjtcclxuICAgIH1cclxuICAgIGluaXQoKSB7XHJcbiAgICAgICAgY29uc3QgdmVydGljZXMgPSBuZXcgRmxvYXQzMkFycmF5KFtcclxuICAgICAgICAgICAgLTEsIC0xLFxyXG4gICAgICAgICAgICAxLCAxLFxyXG4gICAgICAgICAgICAxLCAtMSxcclxuICAgICAgICAgICAgLTEsIC0xLFxyXG4gICAgICAgICAgICAtMSwgMSxcclxuICAgICAgICAgICAgMSwgMVxyXG4gICAgICAgIF0pO1xyXG4gICAgICAgIHRoaXMudmVydGV4QnVmZmVyID0gdGhpcy5kZXZpY2UuY3JlYXRlQnVmZmVyKHtcclxuICAgICAgICAgICAgc2l6ZTogdmVydGljZXMuYnl0ZUxlbmd0aCxcclxuICAgICAgICAgICAgdXNhZ2U6IEdQVUJ1ZmZlclVzYWdlLlZFUlRFWCB8IEdQVUJ1ZmZlclVzYWdlLkNPUFlfRFNULFxyXG4gICAgICAgICAgICBtYXBwZWRBdENyZWF0aW9uOiB0cnVlLFxyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIG5ldyBGbG9hdDMyQXJyYXkodGhpcy52ZXJ0ZXhCdWZmZXIuZ2V0TWFwcGVkUmFuZ2UoKSkuc2V0KHZlcnRpY2VzKTtcclxuICAgICAgICB0aGlzLnZlcnRleEJ1ZmZlci51bm1hcCgpO1xyXG4gICAgICAgIHRoaXMudW5pZm9ybUJ1ZmZlciA9IHRoaXMuZGV2aWNlLmNyZWF0ZUJ1ZmZlcih7XHJcbiAgICAgICAgICAgIHNpemU6IHZlcnRpY2VzLmJ5dGVMZW5ndGgsXHJcbiAgICAgICAgICAgIHVzYWdlOiBHUFVCdWZmZXJVc2FnZS5VTklGT1JNIHwgR1BVQnVmZmVyVXNhZ2UuQ09QWV9EU1QsXHJcbiAgICAgICAgICAgIG1hcHBlZEF0Q3JlYXRpb246IGZhbHNlLFxyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIHRoaXMucGlwZWxpbmUgPSB0aGlzLmRldmljZS5jcmVhdGVSZW5kZXJQaXBlbGluZSh7XHJcbiAgICAgICAgICAgIHZlcnRleDoge1xyXG4gICAgICAgICAgICAgICAgbW9kdWxlOiB0aGlzLmRldmljZS5jcmVhdGVTaGFkZXJNb2R1bGUoe1xyXG4gICAgICAgICAgICAgICAgICAgIGNvZGU6IHZlcnRTaGFkZXIsXHJcbiAgICAgICAgICAgICAgICB9KSxcclxuICAgICAgICAgICAgICAgIGVudHJ5UG9pbnQ6ICdtYWluJyxcclxuICAgICAgICAgICAgICAgIGJ1ZmZlcnM6IFtcclxuICAgICAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGFycmF5U3RyaWRlOiAyICogRmxvYXQzMkFycmF5LkJZVEVTX1BFUl9FTEVNRU5ULFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBhdHRyaWJ1dGVzOiBbXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2hhZGVyTG9jYXRpb246IDAsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZm9ybWF0OiAnZmxvYXQzMngyJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvZmZzZXQ6IDAsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBdLFxyXG4gICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICBdLFxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBmcmFnbWVudDoge1xyXG4gICAgICAgICAgICAgICAgbW9kdWxlOiB0aGlzLmRldmljZS5jcmVhdGVTaGFkZXJNb2R1bGUoe1xyXG4gICAgICAgICAgICAgICAgICAgIGNvZGU6IGV4cG9ydHMuZnJhZ1NoYWRlcixcclxuICAgICAgICAgICAgICAgIH0pLFxyXG4gICAgICAgICAgICAgICAgZW50cnlQb2ludDogJ21haW4nLFxyXG4gICAgICAgICAgICAgICAgdGFyZ2V0czogW1xyXG4gICAgICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgZm9ybWF0OiB0aGlzLnByZXNlbnRhdGlvbkZvcm1hdCxcclxuICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgXSxcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgcHJpbWl0aXZlOiB7XHJcbiAgICAgICAgICAgICAgICB0b3BvbG9neTogJ3RyaWFuZ2xlLWxpc3QnLFxyXG4gICAgICAgICAgICAgICAgc3RyaXBJbmRleEZvcm1hdDogdW5kZWZpbmVkLFxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIHRoaXMuYmluZEdyb3VwID0gdGhpcy5kZXZpY2UuY3JlYXRlQmluZEdyb3VwKHtcclxuICAgICAgICAgICAgbGF5b3V0OiB0aGlzLnBpcGVsaW5lLmdldEJpbmRHcm91cExheW91dCgwKSxcclxuICAgICAgICAgICAgZW50cmllczogW1xyXG4gICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICAgIGJpbmRpbmc6IDAsXHJcbiAgICAgICAgICAgICAgICAgICAgcmVzb3VyY2U6IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgYnVmZmVyOiB0aGlzLmJ1ZmZlcixcclxuICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgICBiaW5kaW5nOiAxLFxyXG4gICAgICAgICAgICAgICAgICAgIHJlc291cmNlOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGJ1ZmZlcjogdGhpcy51bmlmb3JtQnVmZmVyXHJcbiAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIF0sXHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcbiAgICByZW5kZXIod2lkdGgsIGhlaWdodCkge1xyXG4gICAgICAgIHJldHVybiBfX2F3YWl0ZXIodGhpcywgdm9pZCAwLCB2b2lkIDAsIGZ1bmN0aW9uKiAoKSB7XHJcbiAgICAgICAgICAgIHRoaXMuZGV2aWNlLnF1ZXVlLndyaXRlQnVmZmVyKHRoaXMudW5pZm9ybUJ1ZmZlciwgMCwgbmV3IEludDMyQXJyYXkoW1xyXG4gICAgICAgICAgICAgICAgd2lkdGgsIGhlaWdodFxyXG4gICAgICAgICAgICBdKSk7XHJcbiAgICAgICAgICAgIGNvbnN0IGNvbW1hbmRFbmNvZGVyID0gdGhpcy5kZXZpY2UuY3JlYXRlQ29tbWFuZEVuY29kZXIoKTtcclxuICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgY29uc3QgcmVuZGVyUGFzc0Rlc2NyaXB0b3IgPSB7XHJcbiAgICAgICAgICAgICAgICAgICAgY29sb3JBdHRhY2htZW50czogW1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2aWV3OiB0aGlzLmNvbnRleHQuZ2V0Q3VycmVudFRleHR1cmUoKS5jcmVhdGVWaWV3KCksXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2FkVmFsdWU6IHsgcjogMC4wLCBnOiAwLjAsIGI6IDAuMCwgYTogMS4wIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdG9yZU9wOiAnc3RvcmUnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICAgIF0sXHJcbiAgICAgICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICAgICAgY29uc3QgcGFzc0VuY29kZXIgPSBjb21tYW5kRW5jb2Rlci5iZWdpblJlbmRlclBhc3MocmVuZGVyUGFzc0Rlc2NyaXB0b3IpO1xyXG4gICAgICAgICAgICAgICAgcGFzc0VuY29kZXIuc2V0UGlwZWxpbmUodGhpcy5waXBlbGluZSk7XHJcbiAgICAgICAgICAgICAgICBwYXNzRW5jb2Rlci5zZXRWZXJ0ZXhCdWZmZXIoMCwgdGhpcy52ZXJ0ZXhCdWZmZXIpO1xyXG4gICAgICAgICAgICAgICAgcGFzc0VuY29kZXIuc2V0QmluZEdyb3VwKDAsIHRoaXMuYmluZEdyb3VwKTtcclxuICAgICAgICAgICAgICAgIHBhc3NFbmNvZGVyLmRyYXcoNiwgMSwgMCwgMCk7XHJcbiAgICAgICAgICAgICAgICBwYXNzRW5jb2Rlci5lbmRQYXNzKCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgdGhpcy5kZXZpY2UucXVldWUuc3VibWl0KFtjb21tYW5kRW5jb2Rlci5maW5pc2goKV0pO1xyXG4gICAgICAgICAgICB5aWVsZCB0aGlzLmRldmljZS5xdWV1ZS5vblN1Ym1pdHRlZFdvcmtEb25lKCk7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcbiAgICBpbml0Rm9yQ2FudmFzKGNhbnZhcykge1xyXG4gICAgICAgIHJldHVybiBfX2F3YWl0ZXIodGhpcywgdm9pZCAwLCB2b2lkIDAsIGZ1bmN0aW9uKiAoKSB7XHJcbiAgICAgICAgICAgIHRoaXMuY29udGV4dCA9IGNhbnZhcy5nZXRDb250ZXh0KCd3ZWJncHUnKTtcclxuICAgICAgICAgICAgdGhpcy5wcmVzZW50YXRpb25Gb3JtYXQgPSB0aGlzLmNvbnRleHQuZ2V0UHJlZmVycmVkRm9ybWF0KHRoaXMuYWRhcHRlcik7XHJcbiAgICAgICAgICAgIHRoaXMuY29udGV4dC5jb25maWd1cmUoe1xyXG4gICAgICAgICAgICAgICAgZGV2aWNlOiB0aGlzLmRldmljZSxcclxuICAgICAgICAgICAgICAgIGZvcm1hdDogdGhpcy5wcmVzZW50YXRpb25Gb3JtYXQsXHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICB0aGlzLmluaXQoKTtcclxuICAgICAgICB9KTtcclxuICAgIH1cclxufVxyXG5leHBvcnRzLlJvb3RCdWZmZXJSZW5kZXJlciA9IFJvb3RCdWZmZXJSZW5kZXJlcjtcclxuIiwiXCJ1c2Ugc3RyaWN0XCI7XHJcbnZhciBfX2F3YWl0ZXIgPSAodGhpcyAmJiB0aGlzLl9fYXdhaXRlcikgfHwgZnVuY3Rpb24gKHRoaXNBcmcsIF9hcmd1bWVudHMsIFAsIGdlbmVyYXRvcikge1xyXG4gICAgZnVuY3Rpb24gYWRvcHQodmFsdWUpIHsgcmV0dXJuIHZhbHVlIGluc3RhbmNlb2YgUCA/IHZhbHVlIDogbmV3IFAoZnVuY3Rpb24gKHJlc29sdmUpIHsgcmVzb2x2ZSh2YWx1ZSk7IH0pOyB9XHJcbiAgICByZXR1cm4gbmV3IChQIHx8IChQID0gUHJvbWlzZSkpKGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHtcclxuICAgICAgICBmdW5jdGlvbiBmdWxmaWxsZWQodmFsdWUpIHsgdHJ5IHsgc3RlcChnZW5lcmF0b3IubmV4dCh2YWx1ZSkpOyB9IGNhdGNoIChlKSB7IHJlamVjdChlKTsgfSB9XHJcbiAgICAgICAgZnVuY3Rpb24gcmVqZWN0ZWQodmFsdWUpIHsgdHJ5IHsgc3RlcChnZW5lcmF0b3JbXCJ0aHJvd1wiXSh2YWx1ZSkpOyB9IGNhdGNoIChlKSB7IHJlamVjdChlKTsgfSB9XHJcbiAgICAgICAgZnVuY3Rpb24gc3RlcChyZXN1bHQpIHsgcmVzdWx0LmRvbmUgPyByZXNvbHZlKHJlc3VsdC52YWx1ZSkgOiBhZG9wdChyZXN1bHQudmFsdWUpLnRoZW4oZnVsZmlsbGVkLCByZWplY3RlZCk7IH1cclxuICAgICAgICBzdGVwKChnZW5lcmF0b3IgPSBnZW5lcmF0b3IuYXBwbHkodGhpc0FyZywgX2FyZ3VtZW50cyB8fCBbXSkpLm5leHQoKSk7XHJcbiAgICB9KTtcclxufTtcclxuT2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFwiX19lc01vZHVsZVwiLCB7IHZhbHVlOiB0cnVlIH0pO1xyXG5leHBvcnRzLlJ1bnRpbWUgPSB2b2lkIDA7XHJcbmNvbnN0IEtlcm5lbF8xID0gcmVxdWlyZShcIi4vS2VybmVsXCIpO1xyXG5jb25zdCBVdGlsc18xID0gcmVxdWlyZShcIi4uL3V0aWxzL1V0aWxzXCIpO1xyXG5jb25zdCBSZW5kZXJSb290QnVmZmVyXzEgPSByZXF1aXJlKFwiLi9SZW5kZXJSb290QnVmZmVyXCIpO1xyXG5jbGFzcyBNYXRlcmlhbGl6ZWRUcmVlIHtcclxufVxyXG5jbGFzcyBSdW50aW1lIHtcclxuICAgIGNvbnN0cnVjdG9yKCkge1xyXG4gICAgICAgIHRoaXMuYWRhcHRlciA9IG51bGw7XHJcbiAgICAgICAgdGhpcy5kZXZpY2UgPSBudWxsO1xyXG4gICAgICAgIHRoaXMua2VybmVscyA9IFtdO1xyXG4gICAgICAgIHRoaXMubWF0ZXJpYWx6ZWRUcmVlcyA9IFtdO1xyXG4gICAgfVxyXG4gICAgaW5pdCgpIHtcclxuICAgICAgICByZXR1cm4gX19hd2FpdGVyKHRoaXMsIHZvaWQgMCwgdm9pZCAwLCBmdW5jdGlvbiogKCkge1xyXG4gICAgICAgICAgICB5aWVsZCB0aGlzLmNyZWF0ZURldmljZSgpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG4gICAgY3JlYXRlRGV2aWNlKCkge1xyXG4gICAgICAgIHJldHVybiBfX2F3YWl0ZXIodGhpcywgdm9pZCAwLCB2b2lkIDAsIGZ1bmN0aW9uKiAoKSB7XHJcbiAgICAgICAgICAgIGlmIChuYXZpZ2F0b3IuZ3B1ID09PSB1bmRlZmluZWQpIHtcclxuICAgICAgICAgICAgICAgIGFsZXJ0KFwiV2ViZ3B1IG5vdCBzdXBwb3J0ZWRcIik7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgY29uc3QgYWRhcHRlciA9IHlpZWxkIG5hdmlnYXRvci5ncHUucmVxdWVzdEFkYXB0ZXIoKTtcclxuICAgICAgICAgICAgY29uc3QgZGV2aWNlID0geWllbGQgYWRhcHRlci5yZXF1ZXN0RGV2aWNlKCk7XHJcbiAgICAgICAgICAgIHRoaXMuZGV2aWNlID0gZGV2aWNlO1xyXG4gICAgICAgICAgICB0aGlzLmFkYXB0ZXIgPSBhZGFwdGVyO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG4gICAgY3JlYXRlVGFzayhwYXJhbXMpIHtcclxuICAgICAgICBsZXQgdGFzayA9IG5ldyBLZXJuZWxfMS5Db21waWxlZFRhc2sodGhpcy5kZXZpY2UsIHBhcmFtcyk7XHJcbiAgICAgICAgcmV0dXJuIHRhc2s7XHJcbiAgICB9XHJcbiAgICBjcmVhdGVLZXJuZWwodGFza3NQYXJhbXMpIHtcclxuICAgICAgICBsZXQga2VybmVsID0gbmV3IEtlcm5lbF8xLkNvbXBpbGVkS2VybmVsKHRoaXMuZGV2aWNlKTtcclxuICAgICAgICBmb3IgKGxldCBwYXJhbXMgb2YgdGFza3NQYXJhbXMpIHtcclxuICAgICAgICAgICAgbGV0IHRhc2sgPSB0aGlzLmNyZWF0ZVRhc2socGFyYW1zKTtcclxuICAgICAgICAgICAga2VybmVsLnRhc2tzLnB1c2godGFzayk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiBrZXJuZWw7XHJcbiAgICB9XHJcbiAgICBzeW5jKCkge1xyXG4gICAgICAgIHJldHVybiBfX2F3YWl0ZXIodGhpcywgdm9pZCAwLCB2b2lkIDAsIGZ1bmN0aW9uKiAoKSB7XHJcbiAgICAgICAgICAgIHlpZWxkIHRoaXMuZGV2aWNlLnF1ZXVlLm9uU3VibWl0dGVkV29ya0RvbmUoKTtcclxuICAgICAgICB9KTtcclxuICAgIH1cclxuICAgIGxhdW5jaEtlcm5lbChrZXJuZWwpIHtcclxuICAgICAgICBsZXQgY29tbWFuZEVuY29kZXIgPSB0aGlzLmRldmljZS5jcmVhdGVDb21tYW5kRW5jb2RlcigpO1xyXG4gICAgICAgIGNvbnN0IHBhc3NFbmNvZGVyID0gY29tbWFuZEVuY29kZXIuYmVnaW5Db21wdXRlUGFzcygpO1xyXG4gICAgICAgIGZvciAobGV0IHRhc2sgb2Yga2VybmVsLnRhc2tzKSB7XHJcbiAgICAgICAgICAgIGlmICh0YXNrLmJpbmRHcm91cCA9PT0gbnVsbCkge1xyXG4gICAgICAgICAgICAgICAgdGFzay5iaW5kR3JvdXAgPSB0aGlzLmRldmljZS5jcmVhdGVCaW5kR3JvdXAoe1xyXG4gICAgICAgICAgICAgICAgICAgIGxheW91dDogdGFzay5waXBlbGluZS5nZXRCaW5kR3JvdXBMYXlvdXQoMCksXHJcbiAgICAgICAgICAgICAgICAgICAgZW50cmllczogW1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBiaW5kaW5nOiAwLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzb3VyY2U6IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBidWZmZXI6IHRoaXMubWF0ZXJpYWx6ZWRUcmVlc1swXS5yb290QnVmZmVyLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICBdLFxyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcGFzc0VuY29kZXIuc2V0UGlwZWxpbmUodGFzay5waXBlbGluZSk7XHJcbiAgICAgICAgICAgIHBhc3NFbmNvZGVyLnNldEJpbmRHcm91cCgwLCB0YXNrLmJpbmRHcm91cCk7XHJcbiAgICAgICAgICAgIGxldCBudW1Xb3JrR3JvdXBzID0gKDAsIFV0aWxzXzEuZGl2VXApKHRhc2sucGFyYW1zLmludm9jYXRvaW9ucywgMTI4KTtcclxuICAgICAgICAgICAgcGFzc0VuY29kZXIuZGlzcGF0Y2gobnVtV29ya0dyb3Vwcyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHBhc3NFbmNvZGVyLmVuZFBhc3MoKTtcclxuICAgICAgICB0aGlzLmRldmljZS5xdWV1ZS5zdWJtaXQoW2NvbW1hbmRFbmNvZGVyLmZpbmlzaCgpXSk7XHJcbiAgICB9XHJcbiAgICBtYXRlcmlhbGl6ZVRyZWUodHJlZSkge1xyXG4gICAgICAgIGxldCBzaXplID0gdHJlZS5zaXplO1xyXG4gICAgICAgIGxldCByb290QnVmZmVyID0gdGhpcy5kZXZpY2UuY3JlYXRlQnVmZmVyKHtcclxuICAgICAgICAgICAgc2l6ZTogc2l6ZSxcclxuICAgICAgICAgICAgdXNhZ2U6IEdQVUJ1ZmZlclVzYWdlLlNUT1JBR0UgfCBHUFVCdWZmZXJVc2FnZS5DT1BZX0RTVCB8IEdQVUJ1ZmZlclVzYWdlLkNPUFlfU1JDLFxyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIGxldCBkZXZpY2UgPSB0aGlzLmRldmljZTtcclxuICAgICAgICBsZXQgbWF0ZXJpYWxpemVkID0ge1xyXG4gICAgICAgICAgICB0cmVlLFxyXG4gICAgICAgICAgICByb290QnVmZmVyLFxyXG4gICAgICAgICAgICBkZXZpY2VcclxuICAgICAgICB9O1xyXG4gICAgICAgIHRoaXMubWF0ZXJpYWx6ZWRUcmVlcy5wdXNoKG1hdGVyaWFsaXplZCk7XHJcbiAgICB9XHJcbiAgICBjb3B5Um9vdEJ1ZmZlclRvSG9zdCh0cmVlSWQpIHtcclxuICAgICAgICByZXR1cm4gX19hd2FpdGVyKHRoaXMsIHZvaWQgMCwgdm9pZCAwLCBmdW5jdGlvbiogKCkge1xyXG4gICAgICAgICAgICBsZXQgc2l6ZSA9IHRoaXMubWF0ZXJpYWx6ZWRUcmVlc1t0cmVlSWRdLnRyZWUuc2l6ZTtcclxuICAgICAgICAgICAgY29uc3Qgcm9vdEJ1ZmZlckNvcHkgPSB0aGlzLmRldmljZS5jcmVhdGVCdWZmZXIoe1xyXG4gICAgICAgICAgICAgICAgc2l6ZTogc2l6ZSxcclxuICAgICAgICAgICAgICAgIHVzYWdlOiBHUFVCdWZmZXJVc2FnZS5DT1BZX0RTVCB8IEdQVUJ1ZmZlclVzYWdlLk1BUF9SRUFELFxyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgbGV0IGNvbW1hbmRFbmNvZGVyID0gdGhpcy5kZXZpY2UuY3JlYXRlQ29tbWFuZEVuY29kZXIoKTtcclxuICAgICAgICAgICAgY29tbWFuZEVuY29kZXIuY29weUJ1ZmZlclRvQnVmZmVyKHRoaXMubWF0ZXJpYWx6ZWRUcmVlc1t0cmVlSWRdLnJvb3RCdWZmZXIsIDAsIHJvb3RCdWZmZXJDb3B5LCAwLCBzaXplKTtcclxuICAgICAgICAgICAgdGhpcy5kZXZpY2UucXVldWUuc3VibWl0KFtjb21tYW5kRW5jb2Rlci5maW5pc2goKV0pO1xyXG4gICAgICAgICAgICB5aWVsZCB0aGlzLmRldmljZS5xdWV1ZS5vblN1Ym1pdHRlZFdvcmtEb25lKCk7XHJcbiAgICAgICAgICAgIHlpZWxkIHJvb3RCdWZmZXJDb3B5Lm1hcEFzeW5jKEdQVU1hcE1vZGUuUkVBRCk7XHJcbiAgICAgICAgICAgIGxldCByZXN1bHQgPSBuZXcgSW50MzJBcnJheShyb290QnVmZmVyQ29weS5nZXRNYXBwZWRSYW5nZSgpKTtcclxuICAgICAgICAgICAgbGV0IGNvcGllZCA9IHJlc3VsdC5zbGljZSgpO1xyXG4gICAgICAgICAgICByb290QnVmZmVyQ29weS51bm1hcCgpO1xyXG4gICAgICAgICAgICByb290QnVmZmVyQ29weS5kZXN0cm95KCk7XHJcbiAgICAgICAgICAgIHJldHVybiBjb3BpZWQ7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcbiAgICBnZXRSb290QnVmZmVyUmVuZGVyZXIoY2FudmFzKSB7XHJcbiAgICAgICAgcmV0dXJuIF9fYXdhaXRlcih0aGlzLCB2b2lkIDAsIHZvaWQgMCwgZnVuY3Rpb24qICgpIHtcclxuICAgICAgICAgICAgbGV0IHJlbmRlcmVyID0gbmV3IFJlbmRlclJvb3RCdWZmZXJfMS5Sb290QnVmZmVyUmVuZGVyZXIodGhpcy5hZGFwdGVyLCB0aGlzLmRldmljZSwgdGhpcy5tYXRlcmlhbHplZFRyZWVzWzBdLnJvb3RCdWZmZXIpO1xyXG4gICAgICAgICAgICB5aWVsZCByZW5kZXJlci5pbml0Rm9yQ2FudmFzKGNhbnZhcyk7XHJcbiAgICAgICAgICAgIHJldHVybiByZW5kZXJlcjtcclxuICAgICAgICB9KTtcclxuICAgIH1cclxufVxyXG5leHBvcnRzLlJ1bnRpbWUgPSBSdW50aW1lO1xyXG4iLCJcInVzZSBzdHJpY3RcIjtcclxudmFyIF9fYXdhaXRlciA9ICh0aGlzICYmIHRoaXMuX19hd2FpdGVyKSB8fCBmdW5jdGlvbiAodGhpc0FyZywgX2FyZ3VtZW50cywgUCwgZ2VuZXJhdG9yKSB7XHJcbiAgICBmdW5jdGlvbiBhZG9wdCh2YWx1ZSkgeyByZXR1cm4gdmFsdWUgaW5zdGFuY2VvZiBQID8gdmFsdWUgOiBuZXcgUChmdW5jdGlvbiAocmVzb2x2ZSkgeyByZXNvbHZlKHZhbHVlKTsgfSk7IH1cclxuICAgIHJldHVybiBuZXcgKFAgfHwgKFAgPSBQcm9taXNlKSkoZnVuY3Rpb24gKHJlc29sdmUsIHJlamVjdCkge1xyXG4gICAgICAgIGZ1bmN0aW9uIGZ1bGZpbGxlZCh2YWx1ZSkgeyB0cnkgeyBzdGVwKGdlbmVyYXRvci5uZXh0KHZhbHVlKSk7IH0gY2F0Y2ggKGUpIHsgcmVqZWN0KGUpOyB9IH1cclxuICAgICAgICBmdW5jdGlvbiByZWplY3RlZCh2YWx1ZSkgeyB0cnkgeyBzdGVwKGdlbmVyYXRvcltcInRocm93XCJdKHZhbHVlKSk7IH0gY2F0Y2ggKGUpIHsgcmVqZWN0KGUpOyB9IH1cclxuICAgICAgICBmdW5jdGlvbiBzdGVwKHJlc3VsdCkgeyByZXN1bHQuZG9uZSA/IHJlc29sdmUocmVzdWx0LnZhbHVlKSA6IGFkb3B0KHJlc3VsdC52YWx1ZSkudGhlbihmdWxmaWxsZWQsIHJlamVjdGVkKTsgfVxyXG4gICAgICAgIHN0ZXAoKGdlbmVyYXRvciA9IGdlbmVyYXRvci5hcHBseSh0aGlzQXJnLCBfYXJndW1lbnRzIHx8IFtdKSkubmV4dCgpKTtcclxuICAgIH0pO1xyXG59O1xyXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgXCJfX2VzTW9kdWxlXCIsIHsgdmFsdWU6IHRydWUgfSk7XHJcbmV4cG9ydHMuY29tcHV0ZUJvaWRzID0gdm9pZCAwO1xyXG5jb25zdCBzcHJpdGVfd2dzbF8xID0gcmVxdWlyZShcIi4vc3ByaXRlLndnc2xcIik7XHJcbmNvbnN0IHVwZGF0ZVNwcml0ZXNfd2dzbF8xID0gcmVxdWlyZShcIi4vdXBkYXRlU3ByaXRlcy53Z3NsXCIpO1xyXG5sZXQgY29tcHV0ZUJvaWRzID0gKGNhbnZhcykgPT4gX19hd2FpdGVyKHZvaWQgMCwgdm9pZCAwLCB2b2lkIDAsIGZ1bmN0aW9uKiAoKSB7XHJcbiAgICBjb25zdCBhZGFwdGVyID0geWllbGQgbmF2aWdhdG9yLmdwdS5yZXF1ZXN0QWRhcHRlcigpO1xyXG4gICAgY29uc3QgZGV2aWNlID0geWllbGQgYWRhcHRlci5yZXF1ZXN0RGV2aWNlKCk7XHJcbiAgICBjb25zdCBjb250ZXh0ID0gY2FudmFzLmdldENvbnRleHQoJ3dlYmdwdScpO1xyXG4gICAgY29uc3QgZGV2aWNlUGl4ZWxSYXRpbyA9IHdpbmRvdy5kZXZpY2VQaXhlbFJhdGlvIHx8IDE7XHJcbiAgICBjb25zdCBwcmVzZW50YXRpb25TaXplID0gW1xyXG4gICAgICAgIGNhbnZhcy5jbGllbnRXaWR0aCAqIGRldmljZVBpeGVsUmF0aW8sXHJcbiAgICAgICAgY2FudmFzLmNsaWVudEhlaWdodCAqIGRldmljZVBpeGVsUmF0aW8sXHJcbiAgICBdO1xyXG4gICAgY29uc3QgcHJlc2VudGF0aW9uRm9ybWF0ID0gY29udGV4dC5nZXRQcmVmZXJyZWRGb3JtYXQoYWRhcHRlcik7XHJcbiAgICBjb250ZXh0LmNvbmZpZ3VyZSh7XHJcbiAgICAgICAgZGV2aWNlLFxyXG4gICAgICAgIGZvcm1hdDogcHJlc2VudGF0aW9uRm9ybWF0LFxyXG4gICAgICAgIHNpemU6IHByZXNlbnRhdGlvblNpemUsXHJcbiAgICB9KTtcclxuICAgIGNvbnN0IHNwcml0ZVNoYWRlck1vZHVsZSA9IGRldmljZS5jcmVhdGVTaGFkZXJNb2R1bGUoeyBjb2RlOiBzcHJpdGVfd2dzbF8xLnNoYWRlciB9KTtcclxuICAgIGNvbnN0IHJlbmRlclBpcGVsaW5lID0gZGV2aWNlLmNyZWF0ZVJlbmRlclBpcGVsaW5lKHtcclxuICAgICAgICB2ZXJ0ZXg6IHtcclxuICAgICAgICAgICAgbW9kdWxlOiBzcHJpdGVTaGFkZXJNb2R1bGUsXHJcbiAgICAgICAgICAgIGVudHJ5UG9pbnQ6ICd2ZXJ0X21haW4nLFxyXG4gICAgICAgICAgICBidWZmZXJzOiBbXHJcbiAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgICAgLy8gaW5zdGFuY2VkIHBhcnRpY2xlcyBidWZmZXJcclxuICAgICAgICAgICAgICAgICAgICBhcnJheVN0cmlkZTogNCAqIDQsXHJcbiAgICAgICAgICAgICAgICAgICAgc3RlcE1vZGU6ICdpbnN0YW5jZScsXHJcbiAgICAgICAgICAgICAgICAgICAgYXR0cmlidXRlczogW1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBpbnN0YW5jZSBwb3NpdGlvblxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc2hhZGVyTG9jYXRpb246IDAsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBvZmZzZXQ6IDAsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBmb3JtYXQ6ICdmbG9hdDMyeDInLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBpbnN0YW5jZSB2ZWxvY2l0eVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc2hhZGVyTG9jYXRpb246IDEsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBvZmZzZXQ6IDIgKiA0LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZm9ybWF0OiAnZmxvYXQzMngyJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICBdLFxyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgICAvLyB2ZXJ0ZXggYnVmZmVyXHJcbiAgICAgICAgICAgICAgICAgICAgYXJyYXlTdHJpZGU6IDIgKiA0LFxyXG4gICAgICAgICAgICAgICAgICAgIHN0ZXBNb2RlOiAndmVydGV4JyxcclxuICAgICAgICAgICAgICAgICAgICBhdHRyaWJ1dGVzOiBbXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHZlcnRleCBwb3NpdGlvbnNcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNoYWRlckxvY2F0aW9uOiAyLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgb2Zmc2V0OiAwLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZm9ybWF0OiAnZmxvYXQzMngyJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICBdLFxyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgXSxcclxuICAgICAgICB9LFxyXG4gICAgICAgIGZyYWdtZW50OiB7XHJcbiAgICAgICAgICAgIG1vZHVsZTogc3ByaXRlU2hhZGVyTW9kdWxlLFxyXG4gICAgICAgICAgICBlbnRyeVBvaW50OiAnZnJhZ19tYWluJyxcclxuICAgICAgICAgICAgdGFyZ2V0czogW1xyXG4gICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICAgIGZvcm1hdDogcHJlc2VudGF0aW9uRm9ybWF0LFxyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgXSxcclxuICAgICAgICB9LFxyXG4gICAgICAgIHByaW1pdGl2ZToge1xyXG4gICAgICAgICAgICB0b3BvbG9neTogJ3RyaWFuZ2xlLWxpc3QnLFxyXG4gICAgICAgIH0sXHJcbiAgICB9KTtcclxuICAgIGNvbnN0IGNvbXB1dGVQaXBlbGluZSA9IGRldmljZS5jcmVhdGVDb21wdXRlUGlwZWxpbmUoe1xyXG4gICAgICAgIGNvbXB1dGU6IHtcclxuICAgICAgICAgICAgbW9kdWxlOiBkZXZpY2UuY3JlYXRlU2hhZGVyTW9kdWxlKHtcclxuICAgICAgICAgICAgICAgIGNvZGU6IHVwZGF0ZVNwcml0ZXNfd2dzbF8xLnNoYWRlcixcclxuICAgICAgICAgICAgfSksXHJcbiAgICAgICAgICAgIGVudHJ5UG9pbnQ6ICdtYWluJyxcclxuICAgICAgICB9LFxyXG4gICAgfSk7XHJcbiAgICAvLyBwcmV0dGllci1pZ25vcmVcclxuICAgIGNvbnN0IHZlcnRleEJ1ZmZlckRhdGEgPSBuZXcgRmxvYXQzMkFycmF5KFtcclxuICAgICAgICAtMC4wMSwgLTAuMDIsIDAuMDEsXHJcbiAgICAgICAgLTAuMDIsIDAuMCwgMC4wMixcclxuICAgIF0pO1xyXG4gICAgY29uc3Qgc3ByaXRlVmVydGV4QnVmZmVyID0gZGV2aWNlLmNyZWF0ZUJ1ZmZlcih7XHJcbiAgICAgICAgc2l6ZTogdmVydGV4QnVmZmVyRGF0YS5ieXRlTGVuZ3RoLFxyXG4gICAgICAgIHVzYWdlOiBHUFVCdWZmZXJVc2FnZS5WRVJURVgsXHJcbiAgICAgICAgbWFwcGVkQXRDcmVhdGlvbjogdHJ1ZSxcclxuICAgIH0pO1xyXG4gICAgbmV3IEZsb2F0MzJBcnJheShzcHJpdGVWZXJ0ZXhCdWZmZXIuZ2V0TWFwcGVkUmFuZ2UoKSkuc2V0KHZlcnRleEJ1ZmZlckRhdGEpO1xyXG4gICAgc3ByaXRlVmVydGV4QnVmZmVyLnVubWFwKCk7XHJcbiAgICBjb25zdCBzaW1QYXJhbXMgPSB7XHJcbiAgICAgICAgZGVsdGFUOiAwLjA0LFxyXG4gICAgICAgIHJ1bGUxRGlzdGFuY2U6IDAuMSxcclxuICAgICAgICBydWxlMkRpc3RhbmNlOiAwLjAyNSxcclxuICAgICAgICBydWxlM0Rpc3RhbmNlOiAwLjAyNSxcclxuICAgICAgICBydWxlMVNjYWxlOiAwLjAyLFxyXG4gICAgICAgIHJ1bGUyU2NhbGU6IDAuMDUsXHJcbiAgICAgICAgcnVsZTNTY2FsZTogMC4wMDUsXHJcbiAgICB9O1xyXG4gICAgY29uc3Qgc2ltUGFyYW1CdWZmZXJTaXplID0gNyAqIEZsb2F0MzJBcnJheS5CWVRFU19QRVJfRUxFTUVOVDtcclxuICAgIGNvbnN0IHNpbVBhcmFtQnVmZmVyID0gZGV2aWNlLmNyZWF0ZUJ1ZmZlcih7XHJcbiAgICAgICAgc2l6ZTogc2ltUGFyYW1CdWZmZXJTaXplLFxyXG4gICAgICAgIHVzYWdlOiBHUFVCdWZmZXJVc2FnZS5VTklGT1JNIHwgR1BVQnVmZmVyVXNhZ2UuQ09QWV9EU1QsXHJcbiAgICB9KTtcclxuICAgIGZ1bmN0aW9uIHVwZGF0ZVNpbVBhcmFtcygpIHtcclxuICAgICAgICBkZXZpY2UucXVldWUud3JpdGVCdWZmZXIoc2ltUGFyYW1CdWZmZXIsIDAsIG5ldyBGbG9hdDMyQXJyYXkoW1xyXG4gICAgICAgICAgICBzaW1QYXJhbXMuZGVsdGFULFxyXG4gICAgICAgICAgICBzaW1QYXJhbXMucnVsZTFEaXN0YW5jZSxcclxuICAgICAgICAgICAgc2ltUGFyYW1zLnJ1bGUyRGlzdGFuY2UsXHJcbiAgICAgICAgICAgIHNpbVBhcmFtcy5ydWxlM0Rpc3RhbmNlLFxyXG4gICAgICAgICAgICBzaW1QYXJhbXMucnVsZTFTY2FsZSxcclxuICAgICAgICAgICAgc2ltUGFyYW1zLnJ1bGUyU2NhbGUsXHJcbiAgICAgICAgICAgIHNpbVBhcmFtcy5ydWxlM1NjYWxlLFxyXG4gICAgICAgIF0pKTtcclxuICAgIH1cclxuICAgIHVwZGF0ZVNpbVBhcmFtcygpO1xyXG4gICAgY29uc3QgbnVtUGFydGljbGVzID0gMTUwMDtcclxuICAgIGNvbnN0IGluaXRpYWxQYXJ0aWNsZURhdGEgPSBuZXcgRmxvYXQzMkFycmF5KG51bVBhcnRpY2xlcyAqIDQpO1xyXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBudW1QYXJ0aWNsZXM7ICsraSkge1xyXG4gICAgICAgIGluaXRpYWxQYXJ0aWNsZURhdGFbNCAqIGkgKyAwXSA9IDIgKiAoTWF0aC5yYW5kb20oKSAtIDAuNSk7XHJcbiAgICAgICAgaW5pdGlhbFBhcnRpY2xlRGF0YVs0ICogaSArIDFdID0gMiAqIChNYXRoLnJhbmRvbSgpIC0gMC41KTtcclxuICAgICAgICBpbml0aWFsUGFydGljbGVEYXRhWzQgKiBpICsgMl0gPSAyICogKE1hdGgucmFuZG9tKCkgLSAwLjUpICogMC4xO1xyXG4gICAgICAgIGluaXRpYWxQYXJ0aWNsZURhdGFbNCAqIGkgKyAzXSA9IDIgKiAoTWF0aC5yYW5kb20oKSAtIDAuNSkgKiAwLjE7XHJcbiAgICB9XHJcbiAgICBjb25zdCBwYXJ0aWNsZUJ1ZmZlcnMgPSBuZXcgQXJyYXkoMik7XHJcbiAgICBjb25zdCBwYXJ0aWNsZUJpbmRHcm91cHMgPSBuZXcgQXJyYXkoMik7XHJcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IDI7ICsraSkge1xyXG4gICAgICAgIHBhcnRpY2xlQnVmZmVyc1tpXSA9IGRldmljZS5jcmVhdGVCdWZmZXIoe1xyXG4gICAgICAgICAgICBzaXplOiBpbml0aWFsUGFydGljbGVEYXRhLmJ5dGVMZW5ndGgsXHJcbiAgICAgICAgICAgIHVzYWdlOiBHUFVCdWZmZXJVc2FnZS5WRVJURVggfCBHUFVCdWZmZXJVc2FnZS5TVE9SQUdFLFxyXG4gICAgICAgICAgICBtYXBwZWRBdENyZWF0aW9uOiB0cnVlLFxyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIG5ldyBGbG9hdDMyQXJyYXkocGFydGljbGVCdWZmZXJzW2ldLmdldE1hcHBlZFJhbmdlKCkpLnNldChpbml0aWFsUGFydGljbGVEYXRhKTtcclxuICAgICAgICBwYXJ0aWNsZUJ1ZmZlcnNbaV0udW5tYXAoKTtcclxuICAgIH1cclxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgMjsgKytpKSB7XHJcbiAgICAgICAgcGFydGljbGVCaW5kR3JvdXBzW2ldID0gZGV2aWNlLmNyZWF0ZUJpbmRHcm91cCh7XHJcbiAgICAgICAgICAgIGxheW91dDogY29tcHV0ZVBpcGVsaW5lLmdldEJpbmRHcm91cExheW91dCgwKSxcclxuICAgICAgICAgICAgZW50cmllczogW1xyXG4gICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICAgIGJpbmRpbmc6IDAsXHJcbiAgICAgICAgICAgICAgICAgICAgcmVzb3VyY2U6IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgYnVmZmVyOiBzaW1QYXJhbUJ1ZmZlcixcclxuICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgICBiaW5kaW5nOiAxLFxyXG4gICAgICAgICAgICAgICAgICAgIHJlc291cmNlOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGJ1ZmZlcjogcGFydGljbGVCdWZmZXJzW2ldLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBvZmZzZXQ6IDAsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHNpemU6IGluaXRpYWxQYXJ0aWNsZURhdGEuYnl0ZUxlbmd0aCxcclxuICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgICBiaW5kaW5nOiAyLFxyXG4gICAgICAgICAgICAgICAgICAgIHJlc291cmNlOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGJ1ZmZlcjogcGFydGljbGVCdWZmZXJzWyhpICsgMSkgJSAyXSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgb2Zmc2V0OiAwLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBzaXplOiBpbml0aWFsUGFydGljbGVEYXRhLmJ5dGVMZW5ndGgsXHJcbiAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIF0sXHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcbiAgICBsZXQgdCA9IDA7XHJcbiAgICBmdW5jdGlvbiBmcmFtZSgpIHtcclxuICAgICAgICBjb25zdCBjb21tYW5kRW5jb2RlciA9IGRldmljZS5jcmVhdGVDb21tYW5kRW5jb2RlcigpO1xyXG4gICAgICAgIHtcclxuICAgICAgICAgICAgY29uc3QgcGFzc0VuY29kZXIgPSBjb21tYW5kRW5jb2Rlci5iZWdpbkNvbXB1dGVQYXNzKCk7XHJcbiAgICAgICAgICAgIHBhc3NFbmNvZGVyLnNldFBpcGVsaW5lKGNvbXB1dGVQaXBlbGluZSk7XHJcbiAgICAgICAgICAgIHBhc3NFbmNvZGVyLnNldEJpbmRHcm91cCgwLCBwYXJ0aWNsZUJpbmRHcm91cHNbdCAlIDJdKTtcclxuICAgICAgICAgICAgcGFzc0VuY29kZXIuZGlzcGF0Y2goTWF0aC5jZWlsKG51bVBhcnRpY2xlcyAvIDY0KSk7XHJcbiAgICAgICAgICAgIHBhc3NFbmNvZGVyLmVuZFBhc3MoKTtcclxuICAgICAgICB9XHJcbiAgICAgICAge1xyXG4gICAgICAgICAgICBjb25zdCByZW5kZXJQYXNzRGVzY3JpcHRvciA9IHtcclxuICAgICAgICAgICAgICAgIGNvbG9yQXR0YWNobWVudHM6IFtcclxuICAgICAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHZpZXc6IGNvbnRleHQuZ2V0Q3VycmVudFRleHR1cmUoKS5jcmVhdGVWaWV3KCksXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvYWRWYWx1ZTogeyByOiAwLjAsIGc6IDAuMCwgYjogMC4wLCBhOiAxLjAgfSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgc3RvcmVPcDogJ3N0b3JlJyxcclxuICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgXSxcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICAgICAgY29uc3QgcGFzc0VuY29kZXIgPSBjb21tYW5kRW5jb2Rlci5iZWdpblJlbmRlclBhc3MocmVuZGVyUGFzc0Rlc2NyaXB0b3IpO1xyXG4gICAgICAgICAgICBwYXNzRW5jb2Rlci5zZXRQaXBlbGluZShyZW5kZXJQaXBlbGluZSk7XHJcbiAgICAgICAgICAgIHBhc3NFbmNvZGVyLnNldFZlcnRleEJ1ZmZlcigwLCBwYXJ0aWNsZUJ1ZmZlcnNbKHQgKyAxKSAlIDJdKTtcclxuICAgICAgICAgICAgcGFzc0VuY29kZXIuc2V0VmVydGV4QnVmZmVyKDEsIHNwcml0ZVZlcnRleEJ1ZmZlcik7XHJcbiAgICAgICAgICAgIHBhc3NFbmNvZGVyLmRyYXcoMywgbnVtUGFydGljbGVzLCAwLCAwKTtcclxuICAgICAgICAgICAgcGFzc0VuY29kZXIuZW5kUGFzcygpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBkZXZpY2UucXVldWUuc3VibWl0KFtjb21tYW5kRW5jb2Rlci5maW5pc2goKV0pO1xyXG4gICAgICAgICsrdDtcclxuICAgICAgICByZXF1ZXN0QW5pbWF0aW9uRnJhbWUoZnJhbWUpO1xyXG4gICAgfVxyXG4gICAgcmVxdWVzdEFuaW1hdGlvbkZyYW1lKGZyYW1lKTtcclxufSk7XHJcbmV4cG9ydHMuY29tcHV0ZUJvaWRzID0gY29tcHV0ZUJvaWRzO1xyXG4iLCJcInVzZSBzdHJpY3RcIjtcclxuT2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFwiX19lc01vZHVsZVwiLCB7IHZhbHVlOiB0cnVlIH0pO1xyXG5leHBvcnRzLnNoYWRlciA9IHZvaWQgMDtcclxuZXhwb3J0cy5zaGFkZXIgPSBgXHJcbltbc3RhZ2UodmVydGV4KV1dXHJcbmZuIHZlcnRfbWFpbihbW2xvY2F0aW9uKDApXV0gYV9wYXJ0aWNsZVBvcyA6IHZlYzI8ZjMyPixcclxuICAgICAgICAgICAgIFtbbG9jYXRpb24oMSldXSBhX3BhcnRpY2xlVmVsIDogdmVjMjxmMzI+LFxyXG4gICAgICAgICAgICAgW1tsb2NhdGlvbigyKV1dIGFfcG9zIDogdmVjMjxmMzI+KSAtPiBbW2J1aWx0aW4ocG9zaXRpb24pXV0gdmVjNDxmMzI+IHtcclxuICBsZXQgYW5nbGUgPSAtYXRhbjIoYV9wYXJ0aWNsZVZlbC54LCBhX3BhcnRpY2xlVmVsLnkpO1xyXG4gIGxldCBwb3MgPSB2ZWMyPGYzMj4oXHJcbiAgICAgIChhX3Bvcy54ICogY29zKGFuZ2xlKSkgLSAoYV9wb3MueSAqIHNpbihhbmdsZSkpLFxyXG4gICAgICAoYV9wb3MueCAqIHNpbihhbmdsZSkpICsgKGFfcG9zLnkgKiBjb3MoYW5nbGUpKSk7XHJcbiAgcmV0dXJuIHZlYzQ8ZjMyPihwb3MgKyBhX3BhcnRpY2xlUG9zLCAwLjAsIDEuMCk7XHJcbn1cclxuXHJcbltbc3RhZ2UoZnJhZ21lbnQpXV1cclxuZm4gZnJhZ19tYWluKCkgLT4gW1tsb2NhdGlvbigwKV1dIHZlYzQ8ZjMyPiB7XHJcbiAgcmV0dXJuIHZlYzQ8ZjMyPigxLjAsIDEuMCwgMS4wLCAxLjApO1xyXG59XHJcblxyXG5gO1xyXG4iLCJcInVzZSBzdHJpY3RcIjtcclxuT2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFwiX19lc01vZHVsZVwiLCB7IHZhbHVlOiB0cnVlIH0pO1xyXG5leHBvcnRzLnNoYWRlciA9IHZvaWQgMDtcclxuZXhwb3J0cy5zaGFkZXIgPSBgXHJcbnN0cnVjdCBQYXJ0aWNsZSB7XHJcbiAgcG9zIDogdmVjMjxmMzI+O1xyXG4gIHZlbCA6IHZlYzI8ZjMyPjtcclxufTtcclxuW1tibG9ja11dIHN0cnVjdCBTaW1QYXJhbXMge1xyXG4gIGRlbHRhVCA6IGYzMjtcclxuICBydWxlMURpc3RhbmNlIDogZjMyO1xyXG4gIHJ1bGUyRGlzdGFuY2UgOiBmMzI7XHJcbiAgcnVsZTNEaXN0YW5jZSA6IGYzMjtcclxuICBydWxlMVNjYWxlIDogZjMyO1xyXG4gIHJ1bGUyU2NhbGUgOiBmMzI7XHJcbiAgcnVsZTNTY2FsZSA6IGYzMjtcclxufTtcclxuW1tibG9ja11dIHN0cnVjdCBQYXJ0aWNsZXMge1xyXG4gIHBhcnRpY2xlcyA6IFtbc3RyaWRlKDE2KV1dIGFycmF5PFBhcnRpY2xlPjtcclxufTtcclxuW1tiaW5kaW5nKDApLCBncm91cCgwKV1dIHZhcjx1bmlmb3JtPiBwYXJhbXMgOiBTaW1QYXJhbXM7XHJcbltbYmluZGluZygxKSwgZ3JvdXAoMCldXSB2YXI8c3RvcmFnZSwgcmVhZD4gcGFydGljbGVzQSA6IFBhcnRpY2xlcztcclxuW1tiaW5kaW5nKDIpLCBncm91cCgwKV1dIHZhcjxzdG9yYWdlLCByZWFkX3dyaXRlPiBwYXJ0aWNsZXNCIDogUGFydGljbGVzO1xyXG5cclxuLy8gaHR0cHM6Ly9naXRodWIuY29tL2F1c3RpbkVuZy9Qcm9qZWN0Ni1WdWxrYW4tRmxvY2tpbmcvYmxvYi9tYXN0ZXIvZGF0YS9zaGFkZXJzL2NvbXB1dGVwYXJ0aWNsZXMvcGFydGljbGUuY29tcFxyXG5bW3N0YWdlKGNvbXB1dGUpLCB3b3JrZ3JvdXBfc2l6ZSg2NCldXVxyXG5mbiBtYWluKFtbYnVpbHRpbihnbG9iYWxfaW52b2NhdGlvbl9pZCldXSBHbG9iYWxJbnZvY2F0aW9uSUQgOiB2ZWMzPHUzMj4pIHtcclxuICB2YXIgaW5kZXggOiB1MzIgPSBHbG9iYWxJbnZvY2F0aW9uSUQueDtcclxuXHJcbiAgdmFyIHZQb3MgPSBwYXJ0aWNsZXNBLnBhcnRpY2xlc1tpbmRleF0ucG9zO1xyXG4gIHZhciB2VmVsID0gcGFydGljbGVzQS5wYXJ0aWNsZXNbaW5kZXhdLnZlbDtcclxuICB2YXIgY01hc3MgPSB2ZWMyPGYzMj4oMC4wLCAwLjApO1xyXG4gIHZhciBjVmVsID0gdmVjMjxmMzI+KDAuMCwgMC4wKTtcclxuICB2YXIgY29sVmVsID0gdmVjMjxmMzI+KDAuMCwgMC4wKTtcclxuICB2YXIgY01hc3NDb3VudCA6IHUzMiA9IDB1O1xyXG4gIHZhciBjVmVsQ291bnQgOiB1MzIgPSAwdTtcclxuICB2YXIgcG9zIDogdmVjMjxmMzI+O1xyXG4gIHZhciB2ZWwgOiB2ZWMyPGYzMj47XHJcblxyXG4gIGZvciAodmFyIGkgOiB1MzIgPSAwdTsgaSA8IGFycmF5TGVuZ3RoKCZwYXJ0aWNsZXNBLnBhcnRpY2xlcyk7IGkgPSBpICsgMXUpIHtcclxuICAgIGlmIChpID09IGluZGV4KSB7XHJcbiAgICAgIGNvbnRpbnVlO1xyXG4gICAgfVxyXG5cclxuICAgIHBvcyA9IHBhcnRpY2xlc0EucGFydGljbGVzW2ldLnBvcy54eTtcclxuICAgIHZlbCA9IHBhcnRpY2xlc0EucGFydGljbGVzW2ldLnZlbC54eTtcclxuICAgIGlmIChkaXN0YW5jZShwb3MsIHZQb3MpIDwgcGFyYW1zLnJ1bGUxRGlzdGFuY2UpIHtcclxuICAgICAgY01hc3MgPSBjTWFzcyArIHBvcztcclxuICAgICAgY01hc3NDb3VudCA9IGNNYXNzQ291bnQgKyAxdTtcclxuICAgIH1cclxuICAgIGlmIChkaXN0YW5jZShwb3MsIHZQb3MpIDwgcGFyYW1zLnJ1bGUyRGlzdGFuY2UpIHtcclxuICAgICAgY29sVmVsID0gY29sVmVsIC0gKHBvcyAtIHZQb3MpO1xyXG4gICAgfVxyXG4gICAgaWYgKGRpc3RhbmNlKHBvcywgdlBvcykgPCBwYXJhbXMucnVsZTNEaXN0YW5jZSkge1xyXG4gICAgICBjVmVsID0gY1ZlbCArIHZlbDtcclxuICAgICAgY1ZlbENvdW50ID0gY1ZlbENvdW50ICsgMXU7XHJcbiAgICB9XHJcbiAgfVxyXG4gIGlmIChjTWFzc0NvdW50ID4gMHUpIHtcclxuICAgIHZhciB0ZW1wID0gZjMyKGNNYXNzQ291bnQpO1xyXG4gICAgY01hc3MgPSAoY01hc3MgLyB2ZWMyPGYzMj4odGVtcCwgdGVtcCkpIC0gdlBvcztcclxuICB9XHJcbiAgaWYgKGNWZWxDb3VudCA+IDB1KSB7XHJcbiAgICB2YXIgdGVtcCA9IGYzMihjVmVsQ291bnQpO1xyXG4gICAgY1ZlbCA9IGNWZWwgLyB2ZWMyPGYzMj4odGVtcCwgdGVtcCk7XHJcbiAgfVxyXG4gIHZWZWwgPSB2VmVsICsgKGNNYXNzICogcGFyYW1zLnJ1bGUxU2NhbGUpICsgKGNvbFZlbCAqIHBhcmFtcy5ydWxlMlNjYWxlKSArXHJcbiAgICAgIChjVmVsICogcGFyYW1zLnJ1bGUzU2NhbGUpO1xyXG5cclxuICAvLyBjbGFtcCB2ZWxvY2l0eSBmb3IgYSBtb3JlIHBsZWFzaW5nIHNpbXVsYXRpb25cclxuICB2VmVsID0gbm9ybWFsaXplKHZWZWwpICogY2xhbXAobGVuZ3RoKHZWZWwpLCAwLjAsIDAuMSk7XHJcbiAgLy8ga2luZW1hdGljIHVwZGF0ZVxyXG4gIHZQb3MgPSB2UG9zICsgKHZWZWwgKiBwYXJhbXMuZGVsdGFUKTtcclxuICAvLyBXcmFwIGFyb3VuZCBib3VuZGFyeVxyXG4gIGlmICh2UG9zLnggPCAtMS4wKSB7XHJcbiAgICB2UG9zLnggPSAxLjA7XHJcbiAgfVxyXG4gIGlmICh2UG9zLnggPiAxLjApIHtcclxuICAgIHZQb3MueCA9IC0xLjA7XHJcbiAgfVxyXG4gIGlmICh2UG9zLnkgPCAtMS4wKSB7XHJcbiAgICB2UG9zLnkgPSAxLjA7XHJcbiAgfVxyXG4gIGlmICh2UG9zLnkgPiAxLjApIHtcclxuICAgIHZQb3MueSA9IC0xLjA7XHJcbiAgfVxyXG4gIC8vIFdyaXRlIGJhY2tcclxuICBwYXJ0aWNsZXNCLnBhcnRpY2xlc1tpbmRleF0ucG9zID0gdlBvcztcclxuICBwYXJ0aWNsZXNCLnBhcnRpY2xlc1tpbmRleF0udmVsID0gdlZlbDtcclxufVxyXG5cclxuYDtcclxuIiwiXCJ1c2Ugc3RyaWN0XCI7XHJcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBcIl9fZXNNb2R1bGVcIiwgeyB2YWx1ZTogdHJ1ZSB9KTtcclxuZXhwb3J0cy5zaGFkZXIgPSB2b2lkIDA7XHJcbmV4cG9ydHMuc2hhZGVyID0gYFxyXG5bW2Jsb2NrXV1cclxuc3RydWN0IHR5cGVfNyB7XHJcbiAgICBtZW1iZXI6IFtbc3RyaWRlKDQpXV0gYXJyYXk8aTMyPjtcclxufTtcclxuXHJcbmxldCB0b3RhbF9lbGVtczogaTMyID0gMTA7XHJcblxyXG5sZXQgdG1wNjY1XzogdTMyID0gMHU7XHJcblxyXG5sZXQgdG90YWxfaW52b2NzOiBpMzIgPSAxMjg7XHJcblxyXG5sZXQgdG1wNjc0XzogaTMyID0gMDtcclxuXHJcbmxldCB0bXA2NzZfOiBpMzIgPSAxNTtcclxuXHJcbnZhcjxwcml2YXRlPiBnbG9iYWw6IHZlYzM8dTMyPjtcclxuW1tncm91cCgwKSwgYmluZGluZygwKV1dXHJcbnZhcjxzdG9yYWdlLCByZWFkX3dyaXRlPiByb290X2J1ZmZlcl8wXzogdHlwZV83O1xyXG5cclxuZm4gbWFpbl8xKCkge1xyXG4gICAgdmFyIHBoaV8yOV86IGkzMjtcclxuXHJcbiAgICBsZXQgZTE4ID0gZ2xvYmFsW3RtcDY2NV9dO1xyXG4gICAgcGhpXzI5XyA9IGJpdGNhc3Q8aTMyPihlMTgpO1xyXG4gICAgbG9vcCB7XHJcbiAgICAgICAgbGV0IGUyMSA9IHBoaV8yOV87XHJcbiAgICAgICAgaWYgKChlMjEgPCB0b3RhbF9lbGVtcykpIHtcclxuICAgICAgICAgICAgY29udGludWU7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGNvbnRpbnVpbmcge1xyXG4gICAgICAgICAgICByb290X2J1ZmZlcl8wXy5tZW1iZXJbKChiaXRjYXN0PHUzMj4oKChlMjEgPj4gYml0Y2FzdDx1MzI+KHRtcDY3NF8pKSAmIHRtcDY3Nl8pKSAqIDR1KSA+PiBiaXRjYXN0PHUzMj4oMnUpKV0gPSBlMjE7XHJcbiAgICAgICAgICAgIHBoaV8yOV8gPSAoZTIxICsgdG90YWxfaW52b2NzKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICByZXR1cm47XHJcbn1cclxuXHJcbltbc3RhZ2UoY29tcHV0ZSksIHdvcmtncm91cF9zaXplKDEyOCwgMSwgMSldXVxyXG5mbiBtYWluKFtbYnVpbHRpbihnbG9iYWxfaW52b2NhdGlvbl9pZCldXSBwYXJhbTogdmVjMzx1MzI+KSB7XHJcbiAgICBnbG9iYWwgPSBwYXJhbTtcclxuICAgIG1haW5fMSgpO1xyXG59XHJcbmA7XHJcbiIsIlwidXNlIHN0cmljdFwiO1xyXG52YXIgX19hd2FpdGVyID0gKHRoaXMgJiYgdGhpcy5fX2F3YWl0ZXIpIHx8IGZ1bmN0aW9uICh0aGlzQXJnLCBfYXJndW1lbnRzLCBQLCBnZW5lcmF0b3IpIHtcclxuICAgIGZ1bmN0aW9uIGFkb3B0KHZhbHVlKSB7IHJldHVybiB2YWx1ZSBpbnN0YW5jZW9mIFAgPyB2YWx1ZSA6IG5ldyBQKGZ1bmN0aW9uIChyZXNvbHZlKSB7IHJlc29sdmUodmFsdWUpOyB9KTsgfVxyXG4gICAgcmV0dXJuIG5ldyAoUCB8fCAoUCA9IFByb21pc2UpKShmdW5jdGlvbiAocmVzb2x2ZSwgcmVqZWN0KSB7XHJcbiAgICAgICAgZnVuY3Rpb24gZnVsZmlsbGVkKHZhbHVlKSB7IHRyeSB7IHN0ZXAoZ2VuZXJhdG9yLm5leHQodmFsdWUpKTsgfSBjYXRjaCAoZSkgeyByZWplY3QoZSk7IH0gfVxyXG4gICAgICAgIGZ1bmN0aW9uIHJlamVjdGVkKHZhbHVlKSB7IHRyeSB7IHN0ZXAoZ2VuZXJhdG9yW1widGhyb3dcIl0odmFsdWUpKTsgfSBjYXRjaCAoZSkgeyByZWplY3QoZSk7IH0gfVxyXG4gICAgICAgIGZ1bmN0aW9uIHN0ZXAocmVzdWx0KSB7IHJlc3VsdC5kb25lID8gcmVzb2x2ZShyZXN1bHQudmFsdWUpIDogYWRvcHQocmVzdWx0LnZhbHVlKS50aGVuKGZ1bGZpbGxlZCwgcmVqZWN0ZWQpOyB9XHJcbiAgICAgICAgc3RlcCgoZ2VuZXJhdG9yID0gZ2VuZXJhdG9yLmFwcGx5KHRoaXNBcmcsIF9hcmd1bWVudHMgfHwgW10pKS5uZXh0KCkpO1xyXG4gICAgfSk7XHJcbn07XHJcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBcIl9fZXNNb2R1bGVcIiwgeyB2YWx1ZTogdHJ1ZSB9KTtcclxuZXhwb3J0cy50YWljaGlFeGFtcGxlMCA9IHZvaWQgMDtcclxuY29uc3QgaW5pdDBfd2dzbF8xID0gcmVxdWlyZShcIi4vaW5pdDAud2dzbFwiKTtcclxubGV0IHRhaWNoaUV4YW1wbGUwID0gKCkgPT4gX19hd2FpdGVyKHZvaWQgMCwgdm9pZCAwLCB2b2lkIDAsIGZ1bmN0aW9uKiAoKSB7XHJcbiAgICBjb25zdCBhZGFwdGVyID0geWllbGQgbmF2aWdhdG9yLmdwdS5yZXF1ZXN0QWRhcHRlcigpO1xyXG4gICAgY29uc3QgZGV2aWNlID0geWllbGQgYWRhcHRlci5yZXF1ZXN0RGV2aWNlKCk7XHJcbiAgICBjb25zdCBjb21wdXRlUGlwZWxpbmUgPSBkZXZpY2UuY3JlYXRlQ29tcHV0ZVBpcGVsaW5lKHtcclxuICAgICAgICBjb21wdXRlOiB7XHJcbiAgICAgICAgICAgIG1vZHVsZTogZGV2aWNlLmNyZWF0ZVNoYWRlck1vZHVsZSh7XHJcbiAgICAgICAgICAgICAgICBjb2RlOiBpbml0MF93Z3NsXzEuc2hhZGVyLFxyXG4gICAgICAgICAgICB9KSxcclxuICAgICAgICAgICAgZW50cnlQb2ludDogJ21haW4nLFxyXG4gICAgICAgIH0sXHJcbiAgICB9KTtcclxuICAgIGNvbnN0IHJvb3RCdWZmZXIgPSBkZXZpY2UuY3JlYXRlQnVmZmVyKHtcclxuICAgICAgICBzaXplOiAxMDI0LFxyXG4gICAgICAgIHVzYWdlOiBHUFVCdWZmZXJVc2FnZS5TVE9SQUdFIHwgR1BVQnVmZmVyVXNhZ2UuQ09QWV9EU1QgfCBHUFVCdWZmZXJVc2FnZS5DT1BZX1NSQyxcclxuICAgIH0pO1xyXG4gICAgY29uc3QgYmluZEdyb3VwID0gZGV2aWNlLmNyZWF0ZUJpbmRHcm91cCh7XHJcbiAgICAgICAgbGF5b3V0OiBjb21wdXRlUGlwZWxpbmUuZ2V0QmluZEdyb3VwTGF5b3V0KDApLFxyXG4gICAgICAgIGVudHJpZXM6IFtcclxuICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgYmluZGluZzogMCxcclxuICAgICAgICAgICAgICAgIHJlc291cmNlOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgYnVmZmVyOiByb290QnVmZmVyLFxyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICBdLFxyXG4gICAgfSk7XHJcbiAgICBsZXQgY29tbWFuZEVuY29kZXIgPSBkZXZpY2UuY3JlYXRlQ29tbWFuZEVuY29kZXIoKTtcclxuICAgIHtcclxuICAgICAgICBjb25zdCBwYXNzRW5jb2RlciA9IGNvbW1hbmRFbmNvZGVyLmJlZ2luQ29tcHV0ZVBhc3MoKTtcclxuICAgICAgICBwYXNzRW5jb2Rlci5zZXRQaXBlbGluZShjb21wdXRlUGlwZWxpbmUpO1xyXG4gICAgICAgIHBhc3NFbmNvZGVyLnNldEJpbmRHcm91cCgwLCBiaW5kR3JvdXApO1xyXG4gICAgICAgIHBhc3NFbmNvZGVyLmRpc3BhdGNoKDEsIDEsIDEpO1xyXG4gICAgICAgIHBhc3NFbmNvZGVyLmVuZFBhc3MoKTtcclxuICAgIH1cclxuICAgIGRldmljZS5xdWV1ZS5zdWJtaXQoW2NvbW1hbmRFbmNvZGVyLmZpbmlzaCgpXSk7XHJcbiAgICB5aWVsZCBkZXZpY2UucXVldWUub25TdWJtaXR0ZWRXb3JrRG9uZSgpO1xyXG4gICAgY29uc3Qgcm9vdEJ1ZmZlckNvcHkgPSBkZXZpY2UuY3JlYXRlQnVmZmVyKHtcclxuICAgICAgICBzaXplOiAxMDI0LFxyXG4gICAgICAgIHVzYWdlOiBHUFVCdWZmZXJVc2FnZS5DT1BZX0RTVCB8IEdQVUJ1ZmZlclVzYWdlLk1BUF9SRUFELFxyXG4gICAgfSk7XHJcbiAgICBjb21tYW5kRW5jb2RlciA9IGRldmljZS5jcmVhdGVDb21tYW5kRW5jb2RlcigpO1xyXG4gICAgY29tbWFuZEVuY29kZXIuY29weUJ1ZmZlclRvQnVmZmVyKHJvb3RCdWZmZXIsIDAsIHJvb3RCdWZmZXJDb3B5LCAwLCAxMDI0KTtcclxuICAgIGRldmljZS5xdWV1ZS5zdWJtaXQoW2NvbW1hbmRFbmNvZGVyLmZpbmlzaCgpXSk7XHJcbiAgICB5aWVsZCBkZXZpY2UucXVldWUub25TdWJtaXR0ZWRXb3JrRG9uZSgpO1xyXG4gICAgeWllbGQgcm9vdEJ1ZmZlckNvcHkubWFwQXN5bmMoR1BVTWFwTW9kZS5SRUFEKTtcclxuICAgIGxldCByZXN1bHQgPSBuZXcgSW50MzJBcnJheShyb290QnVmZmVyQ29weS5nZXRNYXBwZWRSYW5nZSgpKTtcclxuICAgIGNvbnNvbGUubG9nKFwiRXhhbXBsZSAwIHJlc3VsdHM6XCIpO1xyXG4gICAgY29uc29sZS5sb2cocmVzdWx0KTtcclxuICAgIHJvb3RCdWZmZXJDb3B5LnVubWFwKCk7XHJcbn0pO1xyXG5leHBvcnRzLnRhaWNoaUV4YW1wbGUwID0gdGFpY2hpRXhhbXBsZTA7XHJcbiIsIlwidXNlIHN0cmljdFwiO1xyXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgXCJfX2VzTW9kdWxlXCIsIHsgdmFsdWU6IHRydWUgfSk7XHJcbmV4cG9ydHMuc2hhZGVyID0gdm9pZCAwO1xyXG5leHBvcnRzLnNoYWRlciA9IGBcclxuW1tibG9ja11dXHJcbnN0cnVjdCB0eXBlXzcge1xyXG4gICAgbWVtYmVyOiBbW3N0cmlkZSg0KV1dIGFycmF5PGkzMj47XHJcbn07XHJcblxyXG5sZXQgdG90YWxfZWxlbXM6IGkzMiA9IDEwO1xyXG5cclxubGV0IHRtcDY2NV86IHUzMiA9IDB1O1xyXG5cclxubGV0IHRvdGFsX2ludm9jczogaTMyID0gMTI4O1xyXG5cclxubGV0IHRtcDY3NF86IGkzMiA9IDA7XHJcblxyXG5sZXQgdG1wNjc2XzogaTMyID0gMTU7XHJcblxyXG52YXI8cHJpdmF0ZT4gZ2xvYmFsOiB2ZWMzPHUzMj47XHJcbltbZ3JvdXAoMCksIGJpbmRpbmcoMCldXVxyXG52YXI8c3RvcmFnZSwgcmVhZF93cml0ZT4gcm9vdF9idWZmZXJfMF86IHR5cGVfNztcclxuXHJcbmZuIG1haW5fMSgpIHtcclxuICAgIHZhciBwaGlfMjlfOiBpMzI7XHJcblxyXG4gICAgbGV0IGUxOCA9IGdsb2JhbFt0bXA2NjVfXTtcclxuICAgIHBoaV8yOV8gPSBiaXRjYXN0PGkzMj4oZTE4KTtcclxuICAgIGxvb3Age1xyXG4gICAgICAgIGxldCBlMjEgPSBwaGlfMjlfO1xyXG4gICAgICAgIGlmICgoZTIxIDwgdG90YWxfZWxlbXMpKSB7XHJcbiAgICAgICAgICAgIGNvbnRpbnVlO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIH1cclxuICAgICAgICBjb250aW51aW5nIHtcclxuICAgICAgICAgICAgcm9vdF9idWZmZXJfMF8ubWVtYmVyWygoYml0Y2FzdDx1MzI+KCgoZTIxID4+IGJpdGNhc3Q8dTMyPih0bXA2NzRfKSkgJiB0bXA2NzZfKSkgKiA0dSkgPj4gYml0Y2FzdDx1MzI+KDJ1KSldID0gZTIxO1xyXG4gICAgICAgICAgICBwaGlfMjlfID0gKGUyMSArIHRvdGFsX2ludm9jcyk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgcmV0dXJuO1xyXG59XHJcblxyXG5bW3N0YWdlKGNvbXB1dGUpLCB3b3JrZ3JvdXBfc2l6ZSgxMjgsIDEsIDEpXV1cclxuZm4gbWFpbihbW2J1aWx0aW4oZ2xvYmFsX2ludm9jYXRpb25faWQpXV0gcGFyYW06IHZlYzM8dTMyPikge1xyXG4gICAgZ2xvYmFsID0gcGFyYW07XHJcbiAgICBtYWluXzEoKTtcclxufVxyXG5gO1xyXG4iLCJcInVzZSBzdHJpY3RcIjtcclxudmFyIF9fYXdhaXRlciA9ICh0aGlzICYmIHRoaXMuX19hd2FpdGVyKSB8fCBmdW5jdGlvbiAodGhpc0FyZywgX2FyZ3VtZW50cywgUCwgZ2VuZXJhdG9yKSB7XHJcbiAgICBmdW5jdGlvbiBhZG9wdCh2YWx1ZSkgeyByZXR1cm4gdmFsdWUgaW5zdGFuY2VvZiBQID8gdmFsdWUgOiBuZXcgUChmdW5jdGlvbiAocmVzb2x2ZSkgeyByZXNvbHZlKHZhbHVlKTsgfSk7IH1cclxuICAgIHJldHVybiBuZXcgKFAgfHwgKFAgPSBQcm9taXNlKSkoZnVuY3Rpb24gKHJlc29sdmUsIHJlamVjdCkge1xyXG4gICAgICAgIGZ1bmN0aW9uIGZ1bGZpbGxlZCh2YWx1ZSkgeyB0cnkgeyBzdGVwKGdlbmVyYXRvci5uZXh0KHZhbHVlKSk7IH0gY2F0Y2ggKGUpIHsgcmVqZWN0KGUpOyB9IH1cclxuICAgICAgICBmdW5jdGlvbiByZWplY3RlZCh2YWx1ZSkgeyB0cnkgeyBzdGVwKGdlbmVyYXRvcltcInRocm93XCJdKHZhbHVlKSk7IH0gY2F0Y2ggKGUpIHsgcmVqZWN0KGUpOyB9IH1cclxuICAgICAgICBmdW5jdGlvbiBzdGVwKHJlc3VsdCkgeyByZXN1bHQuZG9uZSA/IHJlc29sdmUocmVzdWx0LnZhbHVlKSA6IGFkb3B0KHJlc3VsdC52YWx1ZSkudGhlbihmdWxmaWxsZWQsIHJlamVjdGVkKTsgfVxyXG4gICAgICAgIHN0ZXAoKGdlbmVyYXRvciA9IGdlbmVyYXRvci5hcHBseSh0aGlzQXJnLCBfYXJndW1lbnRzIHx8IFtdKSkubmV4dCgpKTtcclxuICAgIH0pO1xyXG59O1xyXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgXCJfX2VzTW9kdWxlXCIsIHsgdmFsdWU6IHRydWUgfSk7XHJcbmV4cG9ydHMudGFpY2hpRXhhbXBsZTEgPSB2b2lkIDA7XHJcbmNvbnN0IGluaXQwX3dnc2xfMSA9IHJlcXVpcmUoXCIuL2luaXQwLndnc2xcIik7XHJcbmNvbnN0IFByb2dyYW1fMSA9IHJlcXVpcmUoXCIuLi8uLi9wcm9ncmFtL1Byb2dyYW1cIik7XHJcbmNvbnN0IEZpZWxkc0ZhY3RvcnlfMSA9IHJlcXVpcmUoXCIuLi8uLi9wcm9ncmFtL0ZpZWxkc0ZhY3RvcnlcIik7XHJcbmxldCB0YWljaGlFeGFtcGxlMSA9ICgpID0+IF9fYXdhaXRlcih2b2lkIDAsIHZvaWQgMCwgdm9pZCAwLCBmdW5jdGlvbiogKCkge1xyXG4gICAgeWllbGQgUHJvZ3JhbV8xLnByb2dyYW0ubWF0ZXJpYWxpemVSdW50aW1lKCk7XHJcbiAgICBsZXQgeCA9ICgwLCBGaWVsZHNGYWN0b3J5XzEuZmllbGQpKFsxMF0pO1xyXG4gICAgUHJvZ3JhbV8xLnByb2dyYW0ubWF0ZXJpYWxpemVDdXJyZW50VHJlZSgpO1xyXG4gICAgbGV0IGluaXRLZXJuZWwgPSBQcm9ncmFtXzEucHJvZ3JhbS5ydW50aW1lLmNyZWF0ZUtlcm5lbChbe1xyXG4gICAgICAgICAgICBjb2RlOiBpbml0MF93Z3NsXzEuc2hhZGVyLFxyXG4gICAgICAgICAgICBpbnZvY2F0b2lvbnM6IDEwXHJcbiAgICAgICAgfV0pO1xyXG4gICAgUHJvZ3JhbV8xLnByb2dyYW0ucnVudGltZS5sYXVuY2hLZXJuZWwoaW5pdEtlcm5lbCk7XHJcbiAgICB5aWVsZCBQcm9ncmFtXzEucHJvZ3JhbS5ydW50aW1lLnN5bmMoKTtcclxuICAgIGxldCByb290QnVmZmVyQ29weSA9IHlpZWxkIFByb2dyYW1fMS5wcm9ncmFtLnJ1bnRpbWUuY29weVJvb3RCdWZmZXJUb0hvc3QoMCk7XHJcbiAgICBjb25zb2xlLmxvZyhcIkV4YW1wbGUgMSByZXN1bHRzOlwiKTtcclxuICAgIGNvbnNvbGUubG9nKHJvb3RCdWZmZXJDb3B5KTtcclxufSk7XHJcbmV4cG9ydHMudGFpY2hpRXhhbXBsZTEgPSB0YWljaGlFeGFtcGxlMTtcclxuIiwiXCJ1c2Ugc3RyaWN0XCI7XHJcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBcIl9fZXNNb2R1bGVcIiwgeyB2YWx1ZTogdHJ1ZSB9KTtcclxuZXhwb3J0cy5zaGFkZXIgPSB2b2lkIDA7XHJcbmV4cG9ydHMuc2hhZGVyID0gYFxyXG5bW2Jsb2NrXV1cclxuc3RydWN0IHR5cGVfOCB7XHJcbiAgICBtZW1iZXI6IFtbc3RyaWRlKDQpXV0gYXJyYXk8aTMyPjtcclxufTtcclxuXHJcbmxldCB0b3RhbGVfbGVtczogaTMyID0gMjAwMDAwO1xyXG5cclxubGV0IHRtcDEyOTRfOiB1MzIgPSAwdTtcclxuXHJcbmxldCB0b3RhbF9pbnZvY3M6IGkzMiA9IDIwMDA2NDtcclxuXHJcbmxldCB0bXAxNDg1XzogaTMyID0gMztcclxuXHJcbmxldCB0bXAxXzogZjMyID0gMS4wO1xyXG5cclxubGV0IHRtcDNfOiBmMzIgPSAwLjU7XHJcblxyXG5sZXQgdG1wNF86IGYzMiA9IDMuMTQxNTkyNzQxMDEyNTczMjtcclxuXHJcbmxldCB0bXAxNTAzXzogaTMyID0gMDtcclxuXHJcbmxldCB0bXAxNDQ1XzogaTMyID0gMjYyMTQzO1xyXG5cclxubGV0IHRtcDEzXzogaTMyID0gNDtcclxuXHJcbmxldCB0bXA1MV86IGYzMiA9IDAuMDUwMDAwMDAwNzQ1MDU4MDY7XHJcblxyXG5sZXQgdG1wOTVfOiBmMzIgPSAwLjA3NTAwMDAwMjk4MDIzMjI0O1xyXG5cclxubGV0IHRtcDEzOF86IGYzMiA9IDAuMjIyMjIyMjIzODc3OTA2ODtcclxuXHJcbmxldCB0bXAxNDNfOiBmMzIgPSAwLjMzMzMzMzM0MzI2NzQ0MDg7XHJcblxyXG5sZXQgdG1wMTUwXzogZjMyID0gMC40NDQ0NDQ0NDc3NTU4MTM2O1xyXG5cclxubGV0IHRtcDE1Nl86IGYzMiA9IDAuMTAwMDAwMDAxNDkwMTE2MTI7XHJcblxyXG52YXI8cHJpdmF0ZT4gZ2xvYmFsOiB2ZWMzPHUzMj47XHJcbltbZ3JvdXAoMCksIGJpbmRpbmcoMCldXVxyXG52YXI8c3RvcmFnZSwgcmVhZF93cml0ZT4gcm9vdF9idWZmZXJfMF86IHR5cGVfODtcclxuXHJcbmZuIG1haW5fMSgpIHtcclxuICAgIHZhciBwaGlfMjlfOiBpMzI7XHJcbiAgICB2YXIgcGhpXzI5OF86IGYzMjtcclxuICAgIHZhciBwaGlfMjk3XzogZjMyO1xyXG4gICAgdmFyIHBoaV83Nl86IGkzMjtcclxuICAgIHZhciBsb2NhbDogZjMyO1xyXG4gICAgdmFyIGxvY2FsXzE6IGYzMjtcclxuICAgIHZhciBwaGlfMzAwXzogZjMyO1xyXG4gICAgdmFyIHBoaV8yOTlfOiBmMzI7XHJcbiAgICB2YXIgcGhpXzE0NF86IGkzMjtcclxuICAgIHZhciBsb2NhbF8yOiBmMzI7XHJcbiAgICB2YXIgbG9jYWxfMzogZjMyO1xyXG4gICAgdmFyIHBoaV8zMDhfOiBmMzI7XHJcbiAgICB2YXIgcGhpXzMwN186IGYzMjtcclxuICAgIHZhciBwaGlfMjEwXzogaTMyO1xyXG4gICAgdmFyIGxvY2FsXzQ6IGYzMjtcclxuICAgIHZhciBsb2NhbF81OiBmMzI7XHJcbiAgICB2YXIgbG9jYWxfNjogZjMyO1xyXG4gICAgdmFyIGxvY2FsXzc6IGYzMjtcclxuICAgIHZhciBsb2NhbF84OiBmMzI7XHJcbiAgICB2YXIgbG9jYWxfOTogZjMyO1xyXG5cclxuICAgIGxldCBlXzM4ID0gZ2xvYmFsW3RtcDEyOTRfXTtcclxuICAgIHBoaV8yOV8gPSBiaXRjYXN0PGkzMj4oZV8zOCk7XHJcbiAgICBsb29wIHtcclxuICAgICAgICBsZXQgZV80MSA9IHBoaV8yOV87XHJcbiAgICAgICAgaWYgKChlXzQxIDwgdG90YWxlX2xlbXMpKSB7XHJcbiAgICAgICAgICAgIGxldCBlXzQ1ID0gKGJpdGNhc3Q8dTMyPigoZV80MSAmIHRtcDE0NDVfKSkgKiA4dSk7XHJcbiAgICAgICAgICAgIGxldCBlXzUxID0gcm9vdF9idWZmZXJfMF8ubWVtYmVyWygoODM4ODY4OHUgKyBlXzQ1KSA+PiBiaXRjYXN0PHUzMj4oMnUpKV07XHJcbiAgICAgICAgICAgIGxldCBlXzUyID0gYml0Y2FzdDxmMzI+KGVfNTEpO1xyXG4gICAgICAgICAgICBsZXQgZV81OCA9IHJvb3RfYnVmZmVyXzBfLm1lbWJlclsoKGVfNDUgKyA4Mzg4NjkydSkgPj4gYml0Y2FzdDx1MzI+KDJ1KSldO1xyXG4gICAgICAgICAgICBsZXQgZV81OSA9IGJpdGNhc3Q8ZjMyPihlXzU4KTtcclxuICAgICAgICAgICAgcGhpXzI5OF8gPSAwLjA7XHJcbiAgICAgICAgICAgIHBoaV8yOTdfID0gMC4wO1xyXG4gICAgICAgICAgICBwaGlfNzZfID0gdG1wMTUwM187XHJcbiAgICAgICAgICAgIGxvb3Age1xyXG4gICAgICAgICAgICAgICAgbGV0IGVfNjEgPSBwaGlfMjk4XztcclxuICAgICAgICAgICAgICAgIGxldCBlXzYzID0gcGhpXzI5N187XHJcbiAgICAgICAgICAgICAgICBsZXQgZV82NSA9IHBoaV83Nl87XHJcbiAgICAgICAgICAgICAgICBsb2NhbCA9IGVfNjM7XHJcbiAgICAgICAgICAgICAgICBsb2NhbF8xID0gZV82MTtcclxuICAgICAgICAgICAgICAgIGxvY2FsXzQgPSBlXzYzO1xyXG4gICAgICAgICAgICAgICAgbG9jYWxfNSA9IGVfNjE7XHJcbiAgICAgICAgICAgICAgICBpZiAoKGVfNjUgPCB0bXAxM18pKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgY29udGludWU7XHJcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgY29udGludWluZyB7XHJcbiAgICAgICAgICAgICAgICAgICAgbGV0IGVfNjggPSBiaXRjYXN0PHUzMj4oKGVfNjUgJiB0bXAxNDg1XykpO1xyXG4gICAgICAgICAgICAgICAgICAgIGxldCBlXzY5ID0gKGVfNjggKiA4dSk7XHJcbiAgICAgICAgICAgICAgICAgICAgbGV0IGVfNzUgPSByb290X2J1ZmZlcl8wXy5tZW1iZXJbKCg4Mzg4NjA4dSArIGVfNjkpID4+IGJpdGNhc3Q8dTMyPigydSkpXTtcclxuICAgICAgICAgICAgICAgICAgICBsZXQgZV83NyA9IChlXzUyIC0gYml0Y2FzdDxmMzI+KGVfNzUpKTtcclxuICAgICAgICAgICAgICAgICAgICBsZXQgZV84MyA9IHJvb3RfYnVmZmVyXzBfLm1lbWJlclsoKGVfNjkgKyA4Mzg4NjEydSkgPj4gYml0Y2FzdDx1MzI+KDJ1KSldO1xyXG4gICAgICAgICAgICAgICAgICAgIGxldCBlXzg0ID0gYml0Y2FzdDxmMzI+KGVfODMpO1xyXG4gICAgICAgICAgICAgICAgICAgIGxldCBlXzg1ID0gKGVfNTkgLSBlXzg0KTtcclxuICAgICAgICAgICAgICAgICAgICBsZXQgZV84OSA9IHNxcnQoKChlXzc3ICogZV83NykgKyAoZV84NSAqIGVfODUpKSk7XHJcbiAgICAgICAgICAgICAgICAgICAgbGV0IGVfOTAgPSAoZV84OSAqIGVfODkpO1xyXG4gICAgICAgICAgICAgICAgICAgIGxldCBlXzk4ID0gcm9vdF9idWZmZXJfMF8ubWVtYmVyWygoODM4ODY3MnUgKyAoZV82OCAqIDR1KSkgPj4gYml0Y2FzdDx1MzI+KDJ1KSldO1xyXG4gICAgICAgICAgICAgICAgICAgIGxldCBlXzk5ID0gYml0Y2FzdDxmMzI+KGVfOTgpO1xyXG4gICAgICAgICAgICAgICAgICAgIGxldCBlXzEwMiA9IChlXzkwICogdG1wNF8pO1xyXG4gICAgICAgICAgICAgICAgICAgIGxldCBlXzEwOSA9ICh0bXAxXyAtIGV4cCgoZV85MCAqIC0xMDAwMC4wKSkpO1xyXG4gICAgICAgICAgICAgICAgICAgIHBoaV8yOThfID0gKGVfNjEgKyAoKCgoZV85OSAqIGVfNzcpIC8gZV8xMDIpICogdG1wM18pICogZV8xMDkpKTtcclxuICAgICAgICAgICAgICAgICAgICBwaGlfMjk3XyA9IChlXzYzICsgKCgoKGVfOTkgKiAoZV84NCAtIGVfNTkpKSAvIGVfMTAyKSAqIHRtcDNfKSAqIGVfMTA5KSk7XHJcbiAgICAgICAgICAgICAgICAgICAgcGhpXzc2XyA9IChlXzY1ICsgMSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgbGV0IGVfMTE2ID0gbG9jYWw7XHJcbiAgICAgICAgICAgIGxldCBlXzExOSA9IGxvY2FsXzE7XHJcbiAgICAgICAgICAgIGxldCBlXzEyMiA9IChlXzU5ICsgKGVfMTE5ICogdG1wNTFfKSk7XHJcbiAgICAgICAgICAgIHBoaV8zMDBfID0gMC4wO1xyXG4gICAgICAgICAgICBwaGlfMjk5XyA9IDAuMDtcclxuICAgICAgICAgICAgcGhpXzE0NF8gPSB0bXAxNTAzXztcclxuICAgICAgICAgICAgbG9vcCB7XHJcbiAgICAgICAgICAgICAgICBsZXQgZV8xMjQgPSBwaGlfMzAwXztcclxuICAgICAgICAgICAgICAgIGxldCBlXzEyNiA9IHBoaV8yOTlfO1xyXG4gICAgICAgICAgICAgICAgbGV0IGVfMTI4ID0gcGhpXzE0NF87XHJcbiAgICAgICAgICAgICAgICBsb2NhbF8yID0gZV8xMjY7XHJcbiAgICAgICAgICAgICAgICBsb2NhbF8zID0gZV8xMjQ7XHJcbiAgICAgICAgICAgICAgICBsb2NhbF82ID0gZV8xMjY7XHJcbiAgICAgICAgICAgICAgICBsb2NhbF83ID0gZV8xMjQ7XHJcbiAgICAgICAgICAgICAgICBpZiAoKGVfMTI4IDwgdG1wMTNfKSkge1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xyXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGNvbnRpbnVpbmcge1xyXG4gICAgICAgICAgICAgICAgICAgIGxldCBlXzEzMSA9IGJpdGNhc3Q8dTMyPigoZV8xMjggJiB0bXAxNDg1XykpO1xyXG4gICAgICAgICAgICAgICAgICAgIGxldCBlXzEzMiA9IChlXzEzMSAqIDh1KTtcclxuICAgICAgICAgICAgICAgICAgICBsZXQgZV8xMzggPSByb290X2J1ZmZlcl8wXy5tZW1iZXJbKCg4Mzg4NjA4dSArIGVfMTMyKSA+PiBiaXRjYXN0PHUzMj4oMnUpKV07XHJcbiAgICAgICAgICAgICAgICAgICAgbGV0IGVfMTQwID0gKChlXzUyICsgKGVfMTE2ICogdG1wNTFfKSkgLSBiaXRjYXN0PGYzMj4oZV8xMzgpKTtcclxuICAgICAgICAgICAgICAgICAgICBsZXQgZV8xNDYgPSByb290X2J1ZmZlcl8wXy5tZW1iZXJbKChlXzEzMiArIDgzODg2MTJ1KSA+PiBiaXRjYXN0PHUzMj4oMnUpKV07XHJcbiAgICAgICAgICAgICAgICAgICAgbGV0IGVfMTQ3ID0gYml0Y2FzdDxmMzI+KGVfMTQ2KTtcclxuICAgICAgICAgICAgICAgICAgICBsZXQgZV8xNDggPSAoZV8xMjIgLSBlXzE0Nyk7XHJcbiAgICAgICAgICAgICAgICAgICAgbGV0IGVfMTUyID0gc3FydCgoKGVfMTQwICogZV8xNDApICsgKGVfMTQ4ICogZV8xNDgpKSk7XHJcbiAgICAgICAgICAgICAgICAgICAgbGV0IGVfMTUzID0gKGVfMTUyICogZV8xNTIpO1xyXG4gICAgICAgICAgICAgICAgICAgIGxldCBlXzE2MSA9IHJvb3RfYnVmZmVyXzBfLm1lbWJlclsoKDgzODg2NzJ1ICsgKGVfMTMxICogNHUpKSA+PiBiaXRjYXN0PHUzMj4oMnUpKV07XHJcbiAgICAgICAgICAgICAgICAgICAgbGV0IGVfMTYyID0gYml0Y2FzdDxmMzI+KGVfMTYxKTtcclxuICAgICAgICAgICAgICAgICAgICBsZXQgZV8xNjUgPSAoZV8xNTMgKiB0bXA0Xyk7XHJcbiAgICAgICAgICAgICAgICAgICAgbGV0IGVfMTcyID0gKHRtcDFfIC0gZXhwKChlXzE1MyAqIC0xMDAwMC4wKSkpO1xyXG4gICAgICAgICAgICAgICAgICAgIHBoaV8zMDBfID0gKGVfMTI0ICsgKCgoKGVfMTYyICogZV8xNDApIC8gZV8xNjUpICogdG1wM18pICogZV8xNzIpKTtcclxuICAgICAgICAgICAgICAgICAgICBwaGlfMjk5XyA9IChlXzEyNiArICgoKChlXzE2MiAqIChlXzE0NyAtIGVfMTIyKSkgLyBlXzE2NSkgKiB0bXAzXykgKiBlXzE3MikpO1xyXG4gICAgICAgICAgICAgICAgICAgIHBoaV8xNDRfID0gKGVfMTI4ICsgMSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgbGV0IGVfMTc5ID0gbG9jYWxfMjtcclxuICAgICAgICAgICAgbGV0IGVfMTgyID0gbG9jYWxfMztcclxuICAgICAgICAgICAgbGV0IGVfMTg1ID0gKGVfNTkgKyAoZV8xODIgKiB0bXA5NV8pKTtcclxuICAgICAgICAgICAgcGhpXzMwOF8gPSAwLjA7XHJcbiAgICAgICAgICAgIHBoaV8zMDdfID0gMC4wO1xyXG4gICAgICAgICAgICBwaGlfMjEwXyA9IHRtcDE1MDNfO1xyXG4gICAgICAgICAgICBsb29wIHtcclxuICAgICAgICAgICAgICAgIGxldCBlXzE4NyA9IHBoaV8zMDhfO1xyXG4gICAgICAgICAgICAgICAgbGV0IGVfMTg5ID0gcGhpXzMwN187XHJcbiAgICAgICAgICAgICAgICBsZXQgZV8xOTEgPSBwaGlfMjEwXztcclxuICAgICAgICAgICAgICAgIGxvY2FsXzggPSBlXzE4OTtcclxuICAgICAgICAgICAgICAgIGxvY2FsXzkgPSBlXzE4NztcclxuICAgICAgICAgICAgICAgIGlmICgoZV8xOTEgPCB0bXAxM18pKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgY29udGludWU7XHJcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgY29udGludWluZyB7XHJcbiAgICAgICAgICAgICAgICAgICAgbGV0IGVfMTk0ID0gYml0Y2FzdDx1MzI+KChlXzE5MSAmIHRtcDE0ODVfKSk7XHJcbiAgICAgICAgICAgICAgICAgICAgbGV0IGVfMTk1ID0gKGVfMTk0ICogOHUpO1xyXG4gICAgICAgICAgICAgICAgICAgIGxldCBlXzIwMSA9IHJvb3RfYnVmZmVyXzBfLm1lbWJlclsoKDgzODg2MDh1ICsgZV8xOTUpID4+IGJpdGNhc3Q8dTMyPigydSkpXTtcclxuICAgICAgICAgICAgICAgICAgICBsZXQgZV8yMDMgPSAoKGVfNTIgKyAoZV8xNzkgKiB0bXA5NV8pKSAtIGJpdGNhc3Q8ZjMyPihlXzIwMSkpO1xyXG4gICAgICAgICAgICAgICAgICAgIGxldCBlXzIwOSA9IHJvb3RfYnVmZmVyXzBfLm1lbWJlclsoKGVfMTk1ICsgODM4ODYxMnUpID4+IGJpdGNhc3Q8dTMyPigydSkpXTtcclxuICAgICAgICAgICAgICAgICAgICBsZXQgZV8yMTAgPSBiaXRjYXN0PGYzMj4oZV8yMDkpO1xyXG4gICAgICAgICAgICAgICAgICAgIGxldCBlXzIxMSA9IChlXzE4NSAtIGVfMjEwKTtcclxuICAgICAgICAgICAgICAgICAgICBsZXQgZV8yMTUgPSBzcXJ0KCgoZV8yMDMgKiBlXzIwMykgKyAoZV8yMTEgKiBlXzIxMSkpKTtcclxuICAgICAgICAgICAgICAgICAgICBsZXQgZV8yMTYgPSAoZV8yMTUgKiBlXzIxNSk7XHJcbiAgICAgICAgICAgICAgICAgICAgbGV0IGVfMjI0ID0gcm9vdF9idWZmZXJfMF8ubWVtYmVyWygoODM4ODY3MnUgKyAoZV8xOTQgKiA0dSkpID4+IGJpdGNhc3Q8dTMyPigydSkpXTtcclxuICAgICAgICAgICAgICAgICAgICBsZXQgZV8yMjUgPSBiaXRjYXN0PGYzMj4oZV8yMjQpO1xyXG4gICAgICAgICAgICAgICAgICAgIGxldCBlXzIyOCA9IChlXzIxNiAqIHRtcDRfKTtcclxuICAgICAgICAgICAgICAgICAgICBsZXQgZV8yMzUgPSAodG1wMV8gLSBleHAoKGVfMjE2ICogLTEwMDAwLjApKSk7XHJcbiAgICAgICAgICAgICAgICAgICAgcGhpXzMwOF8gPSAoZV8xODcgKyAoKCgoZV8yMjUgKiBlXzIwMykgLyBlXzIyOCkgKiB0bXAzXykgKiBlXzIzNSkpO1xyXG4gICAgICAgICAgICAgICAgICAgIHBoaV8zMDdfID0gKGVfMTg5ICsgKCgoKGVfMjI1ICogKGVfMjEwIC0gZV8xODUpKSAvIGVfMjI4KSAqIHRtcDNfKSAqIGVfMjM1KSk7XHJcbiAgICAgICAgICAgICAgICAgICAgcGhpXzIxMF8gPSAoZV8xOTEgKyAxKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBsZXQgZV8yNDIgPSBsb2NhbF80O1xyXG4gICAgICAgICAgICBsZXQgZV8yNDUgPSBsb2NhbF81O1xyXG4gICAgICAgICAgICBsZXQgZV8yNDggPSBsb2NhbF82O1xyXG4gICAgICAgICAgICBsZXQgZV8yNTEgPSBsb2NhbF83O1xyXG4gICAgICAgICAgICBsZXQgZV8yNTYgPSBsb2NhbF84O1xyXG4gICAgICAgICAgICBsZXQgZV8yNTkgPSBsb2NhbF85O1xyXG4gICAgICAgICAgICByb290X2J1ZmZlcl8wXy5tZW1iZXJbKCg4Mzg4Njg4dSArIGVfNDUpID4+IGJpdGNhc3Q8dTMyPigydSkpXSA9IGJpdGNhc3Q8aTMyPigoZV81MiArICgoKChlXzI0MiAqIHRtcDEzOF8pICsgKGVfMjQ4ICogdG1wMTQzXykpICsgKGVfMjU2ICogdG1wMTUwXykpICogdG1wMTU2XykpKTtcclxuICAgICAgICAgICAgcm9vdF9idWZmZXJfMF8ubWVtYmVyWygoZV80NSArIDgzODg2OTJ1KSA+PiBiaXRjYXN0PHUzMj4oMnUpKV0gPSBiaXRjYXN0PGkzMj4oKGVfNTkgKyAoKCgoZV8yNDUgKiB0bXAxMzhfKSArIChlXzI1MSAqIHRtcDE0M18pKSArIChlXzI1OSAqIHRtcDE1MF8pKSAqIHRtcDE1Nl8pKSk7XHJcbiAgICAgICAgICAgIGNvbnRpbnVlO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIH1cclxuICAgICAgICBjb250aW51aW5nIHtcclxuICAgICAgICAgICAgcGhpXzI5XyA9IChlXzQxICsgdG90YWxfaW52b2NzKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICByZXR1cm47XHJcbn1cclxuXHJcbltbc3RhZ2UoY29tcHV0ZSksIHdvcmtncm91cF9zaXplKDEyOCwgMSwgMSldXVxyXG5mbiBtYWluKFtbYnVpbHRpbihnbG9iYWxfaW52b2NhdGlvbl9pZCldXSBwYXJhbTogdmVjMzx1MzI+KSB7XHJcbiAgICBnbG9iYWwgPSBwYXJhbTtcclxuICAgIG1haW5fMSgpO1xyXG59XHJcblxyXG5gO1xyXG4iLCJcInVzZSBzdHJpY3RcIjtcclxuT2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFwiX19lc01vZHVsZVwiLCB7IHZhbHVlOiB0cnVlIH0pO1xyXG5leHBvcnRzLnNoYWRlciA9IHZvaWQgMDtcclxuZXhwb3J0cy5zaGFkZXIgPSBgXHJcbltbYmxvY2tdXVxyXG5zdHJ1Y3QgdHlwZV84IHtcclxuICAgIG1lbWJlcjogW1tzdHJpZGUoNCldXSBhcnJheTxpMzI+O1xyXG59O1xyXG5cclxubGV0IHRvdGFsZV9sZW1zOiBpMzIgPSAyMDAwMDA7XHJcblxyXG5sZXQgdG1wMTMxXzogdTMyID0gMHU7XHJcblxyXG5sZXQgdG90YWxfaW52b2NzOiBpMzIgPSAyMDAwNjQ7XHJcblxyXG5sZXQgdG1wNF86IGYzMiA9IDAuNTtcclxuXHJcbmxldCB0bXA4XzogZjMyID0gMS41O1xyXG5cclxubGV0IHRtcDE1Ml86IGkzMiA9IDI2MjE0MztcclxuXHJcbnZhcjxwcml2YXRlPiBnbG9iYWw6IHZlYzM8dTMyPjtcclxuLy8gW1tncm91cCgwKSwgYmluZGluZygyKV1dXHJcbi8vIHZhcjxzdG9yYWdlLCByZWFkX3dyaXRlPiBnbG9iYWxfdG1wc19idWZmZXI6IHR5cGVfODtcclxuW1tncm91cCgwKSwgYmluZGluZygwKV1dXHJcbnZhcjxzdG9yYWdlLCByZWFkX3dyaXRlPiByb290X2J1ZmZlcl8wXzogdHlwZV84O1xyXG5cclxuZm4gbWFpbl8xKCkge1xyXG4gICAgdmFyIHBoaV8xMzZfOiB1MzI7XHJcbiAgICB2YXIgcGhpXzEzNV86IHUzMjtcclxuICAgIHZhciBwaGlfMTM0XzogdTMyO1xyXG4gICAgdmFyIHBoaV8xMzNfOiB1MzI7XHJcbiAgICB2YXIgcGhpXzI5XzogaTMyO1xyXG5cclxuICAgIGxldCBlXzM4ID0gZ2xvYmFsW3RtcDEzMV9dO1xyXG4gICAgLy8gbGV0IGVfMzkgPSBnbG9iYWxfdG1wc19idWZmZXIubWVtYmVyWzEwMjRdO1xyXG4gICAgLy8gbGV0IGVfNDYgPSBnbG9iYWxfdG1wc19idWZmZXIubWVtYmVyWzEwMjRdO1xyXG4gICAgLy8gZ2xvYmFsX3RtcHNfYnVmZmVyLm1lbWJlclsxMDI0XSA9IChlXzQ2ICsgMSk7XHJcbiAgICBsZXQgZV8zOSA9IDA7XHJcbiAgICBwaGlfMTM2XyA9IDg4Njc1MTIzdTtcclxuICAgIHBoaV8xMzVfID0gNTIxMjg4NjI5dTtcclxuICAgIHBoaV8xMzRfID0gMzYyNDM2MDY5dTtcclxuICAgIHBoaV8xMzNfID0gKCgoNzY1NDMyMXUgKyBlXzM4KSAqICgxMjM0NTY3dSArICg5NzIzNDUxdSAqIGJpdGNhc3Q8dTMyPihlXzM5KSkpKSAqIDM2NDAwNzc3MTV1KTtcclxuICAgIHBoaV8yOV8gPSBiaXRjYXN0PGkzMj4oZV8zOCk7XHJcbiAgICBsb29wIHtcclxuICAgICAgICBsZXQgZV81MCA9IHBoaV8xMzZfO1xyXG4gICAgICAgIGxldCBlXzUyID0gcGhpXzEzNV87XHJcbiAgICAgICAgbGV0IGVfNTQgPSBwaGlfMTM0XztcclxuICAgICAgICBsZXQgZV81NiA9IHBoaV8xMzNfO1xyXG4gICAgICAgIGxldCBlXzU4ID0gcGhpXzI5XztcclxuICAgICAgICBpZiAoKGVfNTggPCB0b3RhbGVfbGVtcykpIHtcclxuICAgICAgICAgICAgY29udGludWU7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGNvbnRpbnVpbmcge1xyXG4gICAgICAgICAgICBsZXQgZV82MiA9IChlXzU2IF4gKGVfNTYgPDwgYml0Y2FzdDx1MzI+KDExdSkpKTtcclxuICAgICAgICAgICAgbGV0IGVfNjkgPSAoKGVfNTAgXiAoZV81MCA+PiBiaXRjYXN0PHUzMj4oMTl1KSkpIF4gKGVfNjIgXiAoZV82MiA+PiBiaXRjYXN0PHUzMj4oOHUpKSkpO1xyXG4gICAgICAgICAgICBsZXQgZV83NSA9IChlXzU0IF4gKGVfNTQgPDwgYml0Y2FzdDx1MzI+KDExdSkpKTtcclxuICAgICAgICAgICAgbGV0IGVfODIgPSAoKGVfNjkgXiAoZV82OSA+PiBiaXRjYXN0PHUzMj4oMTl1KSkpIF4gKGVfNzUgXiAoZV83NSA+PiBiaXRjYXN0PHUzMj4oOHUpKSkpO1xyXG4gICAgICAgICAgICBsZXQgZV85MCA9IChiaXRjYXN0PHUzMj4oKGVfNTggJiB0bXAxNTJfKSkgKiA4dSk7XHJcbiAgICAgICAgICAgIHJvb3RfYnVmZmVyXzBfLm1lbWJlclsoKDgzODg2ODh1ICsgZV85MCkgPj4gYml0Y2FzdDx1MzI+KDJ1KSldID0gYml0Y2FzdDxpMzI+KCgoZjMyKChlXzY5ICogMTAwMDAwMDAwN3UpKSAqIDAuMDAwMDAwMDAwMjMyODMwNjQzNjUzODY5NjMpIC0gdG1wNF8pKTtcclxuICAgICAgICAgICAgcm9vdF9idWZmZXJfMF8ubWVtYmVyWygoZV85MCArIDgzODg2OTJ1KSA+PiBiaXRjYXN0PHUzMj4oMnUpKV0gPSBiaXRjYXN0PGkzMj4oKChmMzIoKGVfODIgKiAxMDAwMDAwMDA3dSkpICogMC4wMDAwMDAwMDA2OTg0OTE5MzA5NjE2MDg5KSAtIHRtcDhfKSk7XHJcbiAgICAgICAgICAgIHBoaV8xMzZfID0gZV84MjtcclxuICAgICAgICAgICAgcGhpXzEzNV8gPSBlXzY5O1xyXG4gICAgICAgICAgICBwaGlfMTM0XyA9IGVfNTA7XHJcbiAgICAgICAgICAgIHBoaV8xMzNfID0gZV81MjtcclxuICAgICAgICAgICAgcGhpXzI5XyA9IChlXzU4ICsgdG90YWxfaW52b2NzKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICByZXR1cm47XHJcbn1cclxuXHJcbltbc3RhZ2UoY29tcHV0ZSksIHdvcmtncm91cF9zaXplKDEyOCwgMSwgMSldXVxyXG5mbiBtYWluKFtbYnVpbHRpbihnbG9iYWxfaW52b2NhdGlvbl9pZCldXSBwYXJhbTogdmVjMzx1MzI+KSB7XHJcbiAgICBnbG9iYWwgPSBwYXJhbTtcclxuICAgIG1haW5fMSgpO1xyXG59XHJcblxyXG5gO1xyXG4iLCJcInVzZSBzdHJpY3RcIjtcclxuT2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFwiX19lc01vZHVsZVwiLCB7IHZhbHVlOiB0cnVlIH0pO1xyXG5leHBvcnRzLnNoYWRlciA9IHZvaWQgMDtcclxuZXhwb3J0cy5zaGFkZXIgPSBgXHJcbltbYmxvY2tdXVxyXG5zdHJ1Y3QgdHlwZV83IHtcclxuICAgIG1lbWJlcjogW1tzdHJpZGUoNCldXSBhcnJheTxpMzI+O1xyXG59O1xyXG5cclxubGV0IHRtcDIzNF86IHUzMiA9IDB1O1xyXG5cclxudmFyPHByaXZhdGU+IGdsb2JhbDogdmVjMzx1MzI+O1xyXG5bW2dyb3VwKDApLCBiaW5kaW5nKDApXV1cclxudmFyPHN0b3JhZ2UsIHJlYWRfd3JpdGU+IHJvb3RfYnVmZmVyXzBfOiB0eXBlXzc7XHJcblxyXG5mbiBtYWluXzEoKSB7XHJcbiAgICBsZXQgZV8yNyA9IGdsb2JhbFt0bXAyMzRfXTtcclxuICAgIGlmICgoYml0Y2FzdDxpMzI+KGVfMjcpID09IGJpdGNhc3Q8aTMyPih0bXAyMzRfKSkpIHtcclxuICAgICAgICByb290X2J1ZmZlcl8wXy5tZW1iZXJbMjA5NzE1MnVdID0gMDtcclxuICAgICAgICByb290X2J1ZmZlcl8wXy5tZW1iZXJbMjA5NzE1M3VdID0gMTA2NTM1MzIxNjtcclxuICAgICAgICByb290X2J1ZmZlcl8wXy5tZW1iZXJbMjA5NzE1NHVdID0gMDtcclxuICAgICAgICByb290X2J1ZmZlcl8wXy5tZW1iZXJbMjA5NzE1NXVdID0gLTEwODIxMzA0MzI7XHJcbiAgICAgICAgcm9vdF9idWZmZXJfMF8ubWVtYmVyWzIwOTcxNTZ1XSA9IDA7XHJcbiAgICAgICAgcm9vdF9idWZmZXJfMF8ubWVtYmVyWzIwOTcxNTd1XSA9IDEwNTAyNTM3MjI7XHJcbiAgICAgICAgcm9vdF9idWZmZXJfMF8ubWVtYmVyWzIwOTcxNTh1XSA9IDA7XHJcbiAgICAgICAgcm9vdF9idWZmZXJfMF8ubWVtYmVyWzIwOTcxNTl1XSA9IC0xMDk3MjI5OTI2O1xyXG4gICAgICAgIHJvb3RfYnVmZmVyXzBfLm1lbWJlclsyMDk3MTY4dV0gPSAxMDY1MzUzMjE2O1xyXG4gICAgICAgIHJvb3RfYnVmZmVyXzBfLm1lbWJlclsyMDk3MTY5dV0gPSAtMTA4MjEzMDQzMjtcclxuICAgICAgICByb290X2J1ZmZlcl8wXy5tZW1iZXJbMjA5NzE3MHVdID0gMTA2NTM1MzIxNjtcclxuICAgICAgICByb290X2J1ZmZlcl8wXy5tZW1iZXJbMjA5NzE3MXVdID0gLTEwODIxMzA0MzI7XHJcbiAgICB9XHJcbiAgICByZXR1cm47XHJcbn1cclxuXHJcbltbc3RhZ2UoY29tcHV0ZSksIHdvcmtncm91cF9zaXplKDEsIDEsIDEpXV1cclxuZm4gbWFpbihbW2J1aWx0aW4oZ2xvYmFsX2ludm9jYXRpb25faWQpXV0gcGFyYW06IHZlYzM8dTMyPikge1xyXG4gICAgZ2xvYmFsID0gcGFyYW07XHJcbiAgICBtYWluXzEoKTtcclxufVxyXG5cclxuYDtcclxuIiwiXCJ1c2Ugc3RyaWN0XCI7XHJcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBcIl9fZXNNb2R1bGVcIiwgeyB2YWx1ZTogdHJ1ZSB9KTtcclxuZXhwb3J0cy5zaGFkZXIgPSB2b2lkIDA7XHJcbmV4cG9ydHMuc2hhZGVyID0gYFxyXG5bW2Jsb2NrXV1cclxuc3RydWN0IHR5cGVfOCB7XHJcbiAgICBtZW1iZXI6IFtbc3RyaWRlKDQpXV0gYXJyYXk8aTMyPjtcclxufTtcclxuXHJcbmxldCB0b3RhbGVfbGVtczogaTMyID0gNDtcclxuXHJcbmxldCB0bXAxOTk1XzogdTMyID0gMHU7XHJcblxyXG5sZXQgdG90YWxfaW52b2NzOiBpMzIgPSAxMjg7XHJcblxyXG5sZXQgdG1wMjA5Ml86IGkzMiA9IDM7XHJcblxyXG5sZXQgdG1wMV86IGYzMiA9IDEuMDtcclxuXHJcbmxldCB0bXAzXzogZjMyID0gMC41O1xyXG5cclxubGV0IHRtcDRfOiBmMzIgPSAzLjE0MTU5Mjc0MTAxMjU3MzI7XHJcblxyXG5sZXQgdG1wNV86IGkzMiA9IDE7XHJcblxyXG5sZXQgdG1wOV86IGkzMiA9IDA7XHJcblxyXG5sZXQgdG1wMTBfOiBpMzIgPSA0O1xyXG5cclxubGV0IHRtcDU0XzogZjMyID0gMC4xMDAwMDAwMDE0OTAxMTYxMjtcclxuXHJcbnZhcjxwcml2YXRlPiBnbG9iYWw6IHZlYzM8dTMyPjtcclxuW1tncm91cCgwKSwgYmluZGluZygwKV1dXHJcbnZhcjxzdG9yYWdlLCByZWFkX3dyaXRlPiByb290X2J1ZmZlcl8wXzogdHlwZV84O1xyXG5cclxuZm4gbWFpbl8xKCkge1xyXG4gICAgdmFyIHBoaV8yOV86IGkzMjtcclxuICAgIHZhciBwaGlfMTgwXzogZjMyO1xyXG4gICAgdmFyIHBoaV8xNzlfOiBmMzI7XHJcbiAgICB2YXIgcGhpXzQ4XzogaTMyO1xyXG4gICAgdmFyIHBoaV8xODJfOiBmMzI7XHJcbiAgICB2YXIgcGhpXzE4MV86IGYzMjtcclxuICAgIHZhciBsb2NhbDogZjMyO1xyXG4gICAgdmFyIGxvY2FsXzE6IGYzMjtcclxuICAgIHZhciBsb2NhbF8yOiBmMzI7XHJcbiAgICB2YXIgbG9jYWxfMzogZjMyO1xyXG5cclxuICAgIGxldCBlXzMzID0gZ2xvYmFsW3RtcDE5OTVfXTtcclxuICAgIHBoaV8yOV8gPSBiaXRjYXN0PGkzMj4oZV8zMyk7XHJcbiAgICBsb29wIHtcclxuICAgICAgICBsZXQgZV8zNiA9IHBoaV8yOV87XHJcbiAgICAgICAgaWYgKChlXzM2IDwgdG90YWxlX2xlbXMpKSB7XHJcbiAgICAgICAgICAgIHBoaV8xODBfID0gMC4wO1xyXG4gICAgICAgICAgICBwaGlfMTc5XyA9IDAuMDtcclxuICAgICAgICAgICAgcGhpXzQ4XyA9IHRtcDlfO1xyXG4gICAgICAgICAgICBsb29wIHtcclxuICAgICAgICAgICAgICAgIGxldCBlXzM5ID0gcGhpXzE4MF87XHJcbiAgICAgICAgICAgICAgICBsZXQgZV80MSA9IHBoaV8xNzlfO1xyXG4gICAgICAgICAgICAgICAgbGV0IGVfNDMgPSBwaGlfNDhfO1xyXG4gICAgICAgICAgICAgICAgbG9jYWwgPSBlXzQxO1xyXG4gICAgICAgICAgICAgICAgbG9jYWxfMSA9IGVfMzk7XHJcbiAgICAgICAgICAgICAgICBpZiAoKGVfNDMgPCB0bXAxMF8pKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKCgoLShzZWxlY3QoMCwgMSwgKGVfMzYgIT0gZV80MykpKSAmIHRtcDVfKSAhPSAwKSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgZV81MiA9IChiaXRjYXN0PHUzMj4oKGVfMzYgJiB0bXAyMDkyXykpICogOHUpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgZV81OCA9IHJvb3RfYnVmZmVyXzBfLm1lbWJlclsoKDgzODg2MDh1ICsgZV81MikgPj4gYml0Y2FzdDx1MzI+KDJ1KSldO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgZV82NSA9IHJvb3RfYnVmZmVyXzBfLm1lbWJlclsoKGVfNTIgKyA4Mzg4NjEydSkgPj4gYml0Y2FzdDx1MzI+KDJ1KSldO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgZV82NiA9IGJpdGNhc3Q8ZjMyPihlXzY1KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IGVfNjggPSBiaXRjYXN0PHUzMj4oKGVfNDMgJiB0bXAyMDkyXykpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgZV82OSA9IChlXzY4ICogOHUpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgZV83NSA9IHJvb3RfYnVmZmVyXzBfLm1lbWJlclsoKDgzODg2MDh1ICsgZV82OSkgPj4gYml0Y2FzdDx1MzI+KDJ1KSldO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgZV83NyA9IChiaXRjYXN0PGYzMj4oZV81OCkgLSBiaXRjYXN0PGYzMj4oZV83NSkpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgZV84MyA9IHJvb3RfYnVmZmVyXzBfLm1lbWJlclsoKGVfNjkgKyA4Mzg4NjEydSkgPj4gYml0Y2FzdDx1MzI+KDJ1KSldO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgZV84NCA9IGJpdGNhc3Q8ZjMyPihlXzgzKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IGVfODUgPSAoZV82NiAtIGVfODQpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgZV84OSA9IHNxcnQoKChlXzc3ICogZV83NykgKyAoZV84NSAqIGVfODUpKSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCBlXzkwID0gKGVfODkgKiBlXzg5KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IGVfOTggPSByb290X2J1ZmZlcl8wXy5tZW1iZXJbKCg4Mzg4NjcydSArIChlXzY4ICogNHUpKSA+PiBiaXRjYXN0PHUzMj4oMnUpKV07XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCBlXzk5ID0gYml0Y2FzdDxmMzI+KGVfOTgpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgZV8xMDIgPSAoZV85MCAqIHRtcDRfKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IGVfMTA5ID0gKHRtcDFfIC0gZXhwKChlXzkwICogLTEwMDAwLjApKSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHBoaV8xODJfID0gKGVfMzkgKyAoKCgoZV85OSAqIGVfNzcpIC8gZV8xMDIpICogdG1wM18pICogZV8xMDkpKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcGhpXzE4MV8gPSAoZV80MSArICgoKChlXzk5ICogKGVfODQgLSBlXzY2KSkgLyBlXzEwMikgKiB0bXAzXykgKiBlXzEwOSkpO1xyXG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHBoaV8xODJfID0gZV8zOTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcGhpXzE4MV8gPSBlXzQxO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICBsZXQgZV8xMTUgPSBwaGlfMTgyXztcclxuICAgICAgICAgICAgICAgICAgICBsZXQgZV8xMTcgPSBwaGlfMTgxXztcclxuICAgICAgICAgICAgICAgICAgICBsb2NhbF8yID0gZV8xMTU7XHJcbiAgICAgICAgICAgICAgICAgICAgbG9jYWxfMyA9IGVfMTE3O1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xyXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGNvbnRpbnVpbmcge1xyXG4gICAgICAgICAgICAgICAgICAgIGxldCBlXzE2MCA9IGxvY2FsXzI7XHJcbiAgICAgICAgICAgICAgICAgICAgcGhpXzE4MF8gPSBlXzE2MDtcclxuICAgICAgICAgICAgICAgICAgICBsZXQgZV8xNjMgPSBsb2NhbF8zO1xyXG4gICAgICAgICAgICAgICAgICAgIHBoaV8xNzlfID0gZV8xNjM7XHJcbiAgICAgICAgICAgICAgICAgICAgcGhpXzQ4XyA9IChlXzQzICsgMSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgbGV0IGVfMTIwID0gbG9jYWw7XHJcbiAgICAgICAgICAgIGxldCBlXzEyMyA9IGxvY2FsXzE7XHJcbiAgICAgICAgICAgIGxldCBlXzEyNyA9IChiaXRjYXN0PHUzMj4oKGVfMzYgJiB0bXAyMDkyXykpICogOHUpO1xyXG4gICAgICAgICAgICBsZXQgZV8xMzMgPSByb290X2J1ZmZlcl8wXy5tZW1iZXJbKCg4Mzg4NjA4dSArIGVfMTI3KSA+PiBiaXRjYXN0PHUzMj4oMnUpKV07XHJcbiAgICAgICAgICAgIGxldCBlXzE0MSA9IHJvb3RfYnVmZmVyXzBfLm1lbWJlclsoKGVfMTI3ICsgODM4ODYxMnUpID4+IGJpdGNhc3Q8dTMyPigydSkpXTtcclxuICAgICAgICAgICAgcm9vdF9idWZmZXJfMF8ubWVtYmVyWygoODM4ODY0MHUgKyBlXzEyNykgPj4gYml0Y2FzdDx1MzI+KDJ1KSldID0gYml0Y2FzdDxpMzI+KChiaXRjYXN0PGYzMj4oZV8xMzMpICsgKGVfMTIwICogdG1wNTRfKSkpO1xyXG4gICAgICAgICAgICByb290X2J1ZmZlcl8wXy5tZW1iZXJbKChlXzEyNyArIDgzODg2NDR1KSA+PiBiaXRjYXN0PHUzMj4oMnUpKV0gPSBiaXRjYXN0PGkzMj4oKGJpdGNhc3Q8ZjMyPihlXzE0MSkgKyAoZV8xMjMgKiB0bXA1NF8pKSk7XHJcbiAgICAgICAgICAgIGNvbnRpbnVlO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIH1cclxuICAgICAgICBjb250aW51aW5nIHtcclxuICAgICAgICAgICAgcGhpXzI5XyA9IChlXzM2ICsgdG90YWxfaW52b2NzKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICByZXR1cm47XHJcbn1cclxuXHJcbltbc3RhZ2UoY29tcHV0ZSksIHdvcmtncm91cF9zaXplKDEyOCwgMSwgMSldXVxyXG5mbiBtYWluKFtbYnVpbHRpbihnbG9iYWxfaW52b2NhdGlvbl9pZCldXSBwYXJhbTogdmVjMzx1MzI+KSB7XHJcbiAgICBnbG9iYWwgPSBwYXJhbTtcclxuICAgIG1haW5fMSgpO1xyXG59XHJcblxyXG5gO1xyXG4iLCJcInVzZSBzdHJpY3RcIjtcclxuT2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFwiX19lc01vZHVsZVwiLCB7IHZhbHVlOiB0cnVlIH0pO1xyXG5leHBvcnRzLnNoYWRlciA9IHZvaWQgMDtcclxuZXhwb3J0cy5zaGFkZXIgPSBgXHJcbltbYmxvY2tdXVxyXG5zdHJ1Y3QgdHlwZV84IHtcclxuICAgIG1lbWJlcjogW1tzdHJpZGUoNCldXSBhcnJheTxpMzI+O1xyXG59O1xyXG5cclxubGV0IGJlZ2luZV94cHJfdmFsdWU6IGkzMiA9IDA7XHJcblxyXG5sZXQgdG90YWxlX2xlbXM6IGkzMiA9IDQ7XHJcblxyXG5sZXQgdG1wMjAzNV86IHUzMiA9IDB1O1xyXG5cclxubGV0IHRvdGFsX2ludm9jczogaTMyID0gMTI4O1xyXG5cclxubGV0IHRtcDIxNzFfOiBpMzIgPSAwO1xyXG5cclxubGV0IHRtcDIxMTJfOiBpMzIgPSAzO1xyXG5cclxudmFyPHByaXZhdGU+IGdsb2JhbDogdmVjMzx1MzI+O1xyXG5bW2dyb3VwKDApLCBiaW5kaW5nKDApXV1cclxudmFyPHN0b3JhZ2UsIHJlYWRfd3JpdGU+IHJvb3RfYnVmZmVyXzBfOiB0eXBlXzg7XHJcblxyXG5mbiBtYWluXzEoKSB7XHJcbiAgICB2YXIgcGhpXzI5XzogaTMyO1xyXG5cclxuICAgIGxldCBlXzI0ID0gZ2xvYmFsW3RtcDIwMzVfXTtcclxuICAgIHBoaV8yOV8gPSAoYml0Y2FzdDxpMzI+KGVfMjQpICsgYmVnaW5lX3hwcl92YWx1ZSk7XHJcbiAgICBsb29wIHtcclxuICAgICAgICBsZXQgZV8yOSA9IHBoaV8yOV87XHJcbiAgICAgICAgaWYgKChlXzI5IDwgKHRvdGFsZV9sZW1zICsgYmVnaW5lX3hwcl92YWx1ZSkpKSB7XHJcbiAgICAgICAgICAgIGxldCBlXzM0ID0gKHRtcDIwMzVfICsgKGJpdGNhc3Q8dTMyPih0bXAyMTcxXykgKiAxMDQ4NTg0MHUpKTtcclxuICAgICAgICAgICAgbGV0IGVfMzYgPSAoKGVfMjkgKyAwKSAmIHRtcDIxMTJfKTtcclxuICAgICAgICAgICAgbGV0IGVfMzkgPSAoKGVfMzQgKyA4Mzg4NjQwdSkgKyAoYml0Y2FzdDx1MzI+KGVfMzYpICogOHUpKTtcclxuICAgICAgICAgICAgbGV0IGVfNDUgPSByb290X2J1ZmZlcl8wXy5tZW1iZXJbKChlXzM5ICsgdG1wMjAzNV8pID4+IGJpdGNhc3Q8dTMyPigydSkpXTtcclxuICAgICAgICAgICAgbGV0IGVfNTAgPSAoKGVfMzQgKyA4Mzg4NjA4dSkgKyAoYml0Y2FzdDx1MzI+KGVfMzYpICogOHUpKTtcclxuICAgICAgICAgICAgcm9vdF9idWZmZXJfMF8ubWVtYmVyWygoZV81MCArIHRtcDIwMzVfKSA+PiBiaXRjYXN0PHUzMj4oMnUpKV0gPSBiaXRjYXN0PGkzMj4oYml0Y2FzdDxmMzI+KGVfNDUpKTtcclxuICAgICAgICAgICAgbGV0IGVfNjIgPSByb290X2J1ZmZlcl8wXy5tZW1iZXJbKChlXzM5ICsgNHUpID4+IGJpdGNhc3Q8dTMyPigydSkpXTtcclxuICAgICAgICAgICAgcm9vdF9idWZmZXJfMF8ubWVtYmVyWygoZV81MCArIDR1KSA+PiBiaXRjYXN0PHUzMj4oMnUpKV0gPSBiaXRjYXN0PGkzMj4oYml0Y2FzdDxmMzI+KGVfNjIpKTtcclxuICAgICAgICAgICAgY29udGludWU7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGNvbnRpbnVpbmcge1xyXG4gICAgICAgICAgICBwaGlfMjlfID0gKGVfMjkgKyB0b3RhbF9pbnZvY3MpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuICAgIHJldHVybjtcclxufVxyXG5cclxuW1tzdGFnZShjb21wdXRlKSwgd29ya2dyb3VwX3NpemUoMTI4LCAxLCAxKV1dXHJcbmZuIG1haW4oW1tidWlsdGluKGdsb2JhbF9pbnZvY2F0aW9uX2lkKV1dIHBhcmFtOiB2ZWMzPHUzMj4pIHtcclxuICAgIGdsb2JhbCA9IHBhcmFtO1xyXG4gICAgbWFpbl8xKCk7XHJcbn1cclxuXHJcbmA7XHJcbiIsIlwidXNlIHN0cmljdFwiO1xyXG52YXIgX19hd2FpdGVyID0gKHRoaXMgJiYgdGhpcy5fX2F3YWl0ZXIpIHx8IGZ1bmN0aW9uICh0aGlzQXJnLCBfYXJndW1lbnRzLCBQLCBnZW5lcmF0b3IpIHtcclxuICAgIGZ1bmN0aW9uIGFkb3B0KHZhbHVlKSB7IHJldHVybiB2YWx1ZSBpbnN0YW5jZW9mIFAgPyB2YWx1ZSA6IG5ldyBQKGZ1bmN0aW9uIChyZXNvbHZlKSB7IHJlc29sdmUodmFsdWUpOyB9KTsgfVxyXG4gICAgcmV0dXJuIG5ldyAoUCB8fCAoUCA9IFByb21pc2UpKShmdW5jdGlvbiAocmVzb2x2ZSwgcmVqZWN0KSB7XHJcbiAgICAgICAgZnVuY3Rpb24gZnVsZmlsbGVkKHZhbHVlKSB7IHRyeSB7IHN0ZXAoZ2VuZXJhdG9yLm5leHQodmFsdWUpKTsgfSBjYXRjaCAoZSkgeyByZWplY3QoZSk7IH0gfVxyXG4gICAgICAgIGZ1bmN0aW9uIHJlamVjdGVkKHZhbHVlKSB7IHRyeSB7IHN0ZXAoZ2VuZXJhdG9yW1widGhyb3dcIl0odmFsdWUpKTsgfSBjYXRjaCAoZSkgeyByZWplY3QoZSk7IH0gfVxyXG4gICAgICAgIGZ1bmN0aW9uIHN0ZXAocmVzdWx0KSB7IHJlc3VsdC5kb25lID8gcmVzb2x2ZShyZXN1bHQudmFsdWUpIDogYWRvcHQocmVzdWx0LnZhbHVlKS50aGVuKGZ1bGZpbGxlZCwgcmVqZWN0ZWQpOyB9XHJcbiAgICAgICAgc3RlcCgoZ2VuZXJhdG9yID0gZ2VuZXJhdG9yLmFwcGx5KHRoaXNBcmcsIF9hcmd1bWVudHMgfHwgW10pKS5uZXh0KCkpO1xyXG4gICAgfSk7XHJcbn07XHJcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBcIl9fZXNNb2R1bGVcIiwgeyB2YWx1ZTogdHJ1ZSB9KTtcclxuZXhwb3J0cy50YWljaGlFeGFtcGxlMlZvcnRleFJpbmcgPSB2b2lkIDA7XHJcbmNvbnN0IGluaXRfdHJhY2Vyc19jNThfMF9rMDAwNV92a190MDBfMSA9IHJlcXVpcmUoXCIuL2luaXRfdHJhY2Vyc19jNThfMF9rMDAwNV92a190MDBcIik7XHJcbmNvbnN0IGluaXRfdHJhY2Vyc19jNThfMF9rMDAwM192a190MDBfMSA9IHJlcXVpcmUoXCIuL2luaXRfdHJhY2Vyc19jNThfMF9rMDAwM192a190MDBcIik7XHJcbmNvbnN0IGFkdmVjdF9jNTZfMF9rMDAwNV92a190MDBfMSA9IHJlcXVpcmUoXCIuL2FkdmVjdF9jNTZfMF9rMDAwNV92a190MDBcIik7XHJcbmNvbnN0IGludGVncmF0ZV92b3J0ZXhfYzU0XzBfazAwMDZfdmtfdDAwXzEgPSByZXF1aXJlKFwiLi9pbnRlZ3JhdGVfdm9ydGV4X2M1NF8wX2swMDA2X3ZrX3QwMFwiKTtcclxuY29uc3QgaW50ZWdyYXRlX3ZvcnRleF9jNTRfMF9rMDAwNl92a190MDFfMSA9IHJlcXVpcmUoXCIuL2ludGVncmF0ZV92b3J0ZXhfYzU0XzBfazAwMDZfdmtfdDAxXCIpO1xyXG5jb25zdCBwYWludF9jNjBfMF9rMDAwOF92a190MDBfMSA9IHJlcXVpcmUoXCIuL3BhaW50X2M2MF8wX2swMDA4X3ZrX3QwMFwiKTtcclxuY29uc3QgcGFpbnRfYzYwXzBfazAwMDhfdmtfdDAxXzEgPSByZXF1aXJlKFwiLi9wYWludF9jNjBfMF9rMDAwOF92a190MDFcIik7XHJcbmNvbnN0IFByb2dyYW1fMSA9IHJlcXVpcmUoXCIuLi8uLi9wcm9ncmFtL1Byb2dyYW1cIik7XHJcbmNvbnN0IEZpZWxkc0ZhY3RvcnlfMSA9IHJlcXVpcmUoXCIuLi8uLi9wcm9ncmFtL0ZpZWxkc0ZhY3RvcnlcIik7XHJcbmxldCB0YWljaGlFeGFtcGxlMlZvcnRleFJpbmcgPSAoY2FudmFzKSA9PiBfX2F3YWl0ZXIodm9pZCAwLCB2b2lkIDAsIHZvaWQgMCwgZnVuY3Rpb24qICgpIHtcclxuICAgIHlpZWxkIFByb2dyYW1fMS5wcm9ncmFtLm1hdGVyaWFsaXplUnVudGltZSgpO1xyXG4gICAgbGV0IHJlc29sdXRpb24gPSBbNTEyLCAxMDI0XTtcclxuICAgIGxldCBuX3ZvcnRleCA9IDQ7XHJcbiAgICBsZXQgbl90cmFjZXIgPSAyMDAwMDA7XHJcbiAgICBsZXQgaW1hZ2UgPSBGaWVsZHNGYWN0b3J5XzEuVmVjdG9yLmZpZWxkKDQsIHJlc29sdXRpb24pO1xyXG4gICAgbGV0IHBvcyA9IEZpZWxkc0ZhY3RvcnlfMS5WZWN0b3IuZmllbGQoMiwgW25fdm9ydGV4XSk7XHJcbiAgICBsZXQgbmV3X3BvcyA9IEZpZWxkc0ZhY3RvcnlfMS5WZWN0b3IuZmllbGQoMiwgW25fdm9ydGV4XSk7XHJcbiAgICBsZXQgdm9ydCA9ICgwLCBGaWVsZHNGYWN0b3J5XzEuZmllbGQpKFtuX3ZvcnRleF0pO1xyXG4gICAgbGV0IHRyYWNlciA9IEZpZWxkc0ZhY3RvcnlfMS5WZWN0b3IuZmllbGQoMiwgW25fdHJhY2VyXSk7XHJcbiAgICBQcm9ncmFtXzEucHJvZ3JhbS5tYXRlcmlhbGl6ZUN1cnJlbnRUcmVlKCk7XHJcbiAgICBsZXQgaW5pdFRyYWNlcnNLZXJuZWwgPSBQcm9ncmFtXzEucHJvZ3JhbS5ydW50aW1lLmNyZWF0ZUtlcm5lbChbXHJcbiAgICAgICAge1xyXG4gICAgICAgICAgICBjb2RlOiBpbml0X3RyYWNlcnNfYzU4XzBfazAwMDVfdmtfdDAwXzEuc2hhZGVyLFxyXG4gICAgICAgICAgICBpbnZvY2F0b2lvbnM6IDFcclxuICAgICAgICB9LFxyXG4gICAgICAgIHtcclxuICAgICAgICAgICAgY29kZTogaW5pdF90cmFjZXJzX2M1OF8wX2swMDAzX3ZrX3QwMF8xLnNoYWRlcixcclxuICAgICAgICAgICAgaW52b2NhdG9pb25zOiBuX3RyYWNlclxyXG4gICAgICAgIH1cclxuICAgIF0pO1xyXG4gICAgbGV0IGFkdmVjdEtlcm5lbCA9IFByb2dyYW1fMS5wcm9ncmFtLnJ1bnRpbWUuY3JlYXRlS2VybmVsKFtcclxuICAgICAgICB7XHJcbiAgICAgICAgICAgIGNvZGU6IGFkdmVjdF9jNTZfMF9rMDAwNV92a190MDBfMS5zaGFkZXIsXHJcbiAgICAgICAgICAgIGludm9jYXRvaW9uczogbl90cmFjZXJcclxuICAgICAgICB9XHJcbiAgICBdKTtcclxuICAgIGxldCBpbnRlZ3JhdGVWb3J0ZXhLZXJuZWwgPSBQcm9ncmFtXzEucHJvZ3JhbS5ydW50aW1lLmNyZWF0ZUtlcm5lbChbXHJcbiAgICAgICAge1xyXG4gICAgICAgICAgICBjb2RlOiBpbnRlZ3JhdGVfdm9ydGV4X2M1NF8wX2swMDA2X3ZrX3QwMF8xLnNoYWRlcixcclxuICAgICAgICAgICAgaW52b2NhdG9pb25zOiBuX3ZvcnRleFxyXG4gICAgICAgIH0sXHJcbiAgICAgICAge1xyXG4gICAgICAgICAgICBjb2RlOiBpbnRlZ3JhdGVfdm9ydGV4X2M1NF8wX2swMDA2X3ZrX3QwMV8xLnNoYWRlcixcclxuICAgICAgICAgICAgaW52b2NhdG9pb25zOiBuX3ZvcnRleFxyXG4gICAgICAgIH1cclxuICAgIF0pO1xyXG4gICAgbGV0IHBhaW50S2VybmVsID0gUHJvZ3JhbV8xLnByb2dyYW0ucnVudGltZS5jcmVhdGVLZXJuZWwoW1xyXG4gICAgICAgIHtcclxuICAgICAgICAgICAgY29kZTogcGFpbnRfYzYwXzBfazAwMDhfdmtfdDAwXzEuc2hhZGVyLFxyXG4gICAgICAgICAgICBpbnZvY2F0b2lvbnM6IHJlc29sdXRpb25bMF0gKiByZXNvbHV0aW9uWzFdXHJcbiAgICAgICAgfSxcclxuICAgICAgICB7XHJcbiAgICAgICAgICAgIGNvZGU6IHBhaW50X2M2MF8wX2swMDA4X3ZrX3QwMV8xLnNoYWRlcixcclxuICAgICAgICAgICAgaW52b2NhdG9pb25zOiByZXNvbHV0aW9uWzBdICogcmVzb2x1dGlvblsxXVxyXG4gICAgICAgIH1cclxuICAgIF0pO1xyXG4gICAgbGV0IHJlbmRlcmVyID0geWllbGQgUHJvZ3JhbV8xLnByb2dyYW0ucnVudGltZS5nZXRSb290QnVmZmVyUmVuZGVyZXIoY2FudmFzKTtcclxuICAgIFByb2dyYW1fMS5wcm9ncmFtLnJ1bnRpbWUubGF1bmNoS2VybmVsKGluaXRUcmFjZXJzS2VybmVsKTtcclxuICAgIGZ1bmN0aW9uIGZyYW1lKCkge1xyXG4gICAgICAgIHJldHVybiBfX2F3YWl0ZXIodGhpcywgdm9pZCAwLCB2b2lkIDAsIGZ1bmN0aW9uKiAoKSB7XHJcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgNDsgKytpKSB7XHJcbiAgICAgICAgICAgICAgICBQcm9ncmFtXzEucHJvZ3JhbS5ydW50aW1lLmxhdW5jaEtlcm5lbChhZHZlY3RLZXJuZWwpO1xyXG4gICAgICAgICAgICAgICAgUHJvZ3JhbV8xLnByb2dyYW0ucnVudGltZS5sYXVuY2hLZXJuZWwoaW50ZWdyYXRlVm9ydGV4S2VybmVsKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBQcm9ncmFtXzEucHJvZ3JhbS5ydW50aW1lLmxhdW5jaEtlcm5lbChwYWludEtlcm5lbCk7XHJcbiAgICAgICAgICAgIHlpZWxkIFByb2dyYW1fMS5wcm9ncmFtLnJ1bnRpbWUuc3luYygpO1xyXG4gICAgICAgICAgICB5aWVsZCByZW5kZXJlci5yZW5kZXIoMTAyNCwgNTEyKTtcclxuICAgICAgICAgICAgY29uc29sZS5sb2coXCJkb25lXCIpO1xyXG4gICAgICAgICAgICByZXF1ZXN0QW5pbWF0aW9uRnJhbWUoZnJhbWUpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG4gICAgcmVxdWVzdEFuaW1hdGlvbkZyYW1lKGZyYW1lKTtcclxufSk7XHJcbmV4cG9ydHMudGFpY2hpRXhhbXBsZTJWb3J0ZXhSaW5nID0gdGFpY2hpRXhhbXBsZTJWb3J0ZXhSaW5nO1xyXG4iLCJcInVzZSBzdHJpY3RcIjtcclxuT2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFwiX19lc01vZHVsZVwiLCB7IHZhbHVlOiB0cnVlIH0pO1xyXG5leHBvcnRzLnNoYWRlciA9IHZvaWQgMDtcclxuZXhwb3J0cy5zaGFkZXIgPSBgXHJcbltbYmxvY2tdXVxyXG5zdHJ1Y3QgdHlwZV83IHtcclxuICAgIG1lbWJlcjogW1tzdHJpZGUoNCldXSBhcnJheTxpMzI+O1xyXG59O1xyXG5cclxubGV0IHRvdGFsZV9sZW1zOiBpMzIgPSA1MjQyODg7XHJcblxyXG5sZXQgdG1wMjM5Nl86IHUzMiA9IDB1O1xyXG5cclxubGV0IHRvdGFsX2ludm9jczogaTMyID0gNTI0Mjg4O1xyXG5cclxubGV0IHRtcDI1MTBfOiBpMzIgPSA5O1xyXG5cclxubGV0IHRtcDI2NzRfOiBpMzIgPSAxMDIzO1xyXG5cclxubGV0IHRtcDI2NzVfOiBpMzIgPSA1MTE7XHJcblxyXG52YXI8cHJpdmF0ZT4gZ2xvYmFsOiB2ZWMzPHUzMj47XHJcbltbZ3JvdXAoMCksIGJpbmRpbmcoMCldXVxyXG52YXI8c3RvcmFnZSwgcmVhZF93cml0ZT4gcm9vdF9idWZmZXJfMF86IHR5cGVfNztcclxuXHJcbmZuIG1haW5fMSgpIHtcclxuICAgIHZhciBwaGlfMjlfOiBpMzI7XHJcblxyXG4gICAgbGV0IGVfMjMgPSBnbG9iYWxbdG1wMjM5Nl9dO1xyXG4gICAgcGhpXzI5XyA9IGJpdGNhc3Q8aTMyPihlXzIzKTtcclxuICAgIGxvb3Age1xyXG4gICAgICAgIGxldCBlXzI2ID0gcGhpXzI5XztcclxuICAgICAgICBpZiAoKGVfMjYgPCB0b3RhbGVfbGVtcykpIHtcclxuICAgICAgICAgICAgY29udGludWU7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGNvbnRpbnVpbmcge1xyXG4gICAgICAgICAgICBsZXQgZV8zNiA9IChiaXRjYXN0PHUzMj4oKChlXzI2ICYgdG1wMjY3NV8pICsgKCgoZV8yNiA+PiBiaXRjYXN0PHUzMj4odG1wMjUxMF8pKSAmIHRtcDI2NzRfKSA8PCBiaXRjYXN0PHUzMj4odG1wMjUxMF8pKSkpICogMTZ1KTtcclxuICAgICAgICAgICAgcm9vdF9idWZmZXJfMF8ubWVtYmVyWyhlXzM2ID4+IGJpdGNhc3Q8dTMyPigydSkpXSA9IDEwNjUzNTMyMTY7XHJcbiAgICAgICAgICAgIHJvb3RfYnVmZmVyXzBfLm1lbWJlclsoKGVfMzYgKyA0dSkgPj4gYml0Y2FzdDx1MzI+KDJ1KSldID0gMTA2NTM1MzIxNjtcclxuICAgICAgICAgICAgcm9vdF9idWZmZXJfMF8ubWVtYmVyWygoZV8zNiArIDh1KSA+PiBiaXRjYXN0PHUzMj4oMnUpKV0gPSAxMDY1MzUzMjE2O1xyXG4gICAgICAgICAgICByb290X2J1ZmZlcl8wXy5tZW1iZXJbKChlXzM2ICsgMTJ1KSA+PiBiaXRjYXN0PHUzMj4oMnUpKV0gPSAxMDY1MzUzMjE2O1xyXG4gICAgICAgICAgICBwaGlfMjlfID0gKGVfMjYgKyB0b3RhbF9pbnZvY3MpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuICAgIHJldHVybjtcclxufVxyXG5cclxuW1tzdGFnZShjb21wdXRlKSwgd29ya2dyb3VwX3NpemUoMTI4LCAxLCAxKV1dXHJcbmZuIG1haW4oW1tidWlsdGluKGdsb2JhbF9pbnZvY2F0aW9uX2lkKV1dIHBhcmFtOiB2ZWMzPHUzMj4pIHtcclxuICAgIGdsb2JhbCA9IHBhcmFtO1xyXG4gICAgbWFpbl8xKCk7XHJcbn1cclxuXHJcbmA7XHJcbiIsIlwidXNlIHN0cmljdFwiO1xyXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgXCJfX2VzTW9kdWxlXCIsIHsgdmFsdWU6IHRydWUgfSk7XHJcbmV4cG9ydHMuc2hhZGVyID0gdm9pZCAwO1xyXG5leHBvcnRzLnNoYWRlciA9IGBcclxuW1tibG9ja11dXHJcbnN0cnVjdCB0eXBlXzgge1xyXG4gICAgbWVtYmVyOiBbW3N0cmlkZSg0KV1dIGFycmF5PGkzMj47XHJcbn07XHJcblxyXG5sZXQgYmVnaW5lX3hwcl92YWx1ZTogaTMyID0gMDtcclxuXHJcbmxldCB0b3RhbGVfbGVtczogaTMyID0gMjAwMDAwO1xyXG5cclxubGV0IHRtcDI0NDNfOiB1MzIgPSAwdTtcclxuXHJcbmxldCB0b3RhbF9pbnZvY3M6IGkzMiA9IDIwMDA2NDtcclxuXHJcbmxldCB0bXAyNjIyXzogaTMyID0gMDtcclxuXHJcbmxldCB0bXAyNTUyXzogaTMyID0gMjYyMTQzO1xyXG5cclxubGV0IHRtcDI4XzogZjMyID0gMC4xMDAwMDAwMDE0OTAxMTYxMjtcclxuXHJcbmxldCB0bXAzMF86IGYzMiA9IDAuNTtcclxuXHJcbmxldCB0bXAzMl86IGYzMiA9IDUxLjIwMDAwMDc2MjkzOTQ1O1xyXG5cclxubGV0IHRtcDM0XzogZjMyID0gNTEyLjA7XHJcblxyXG5sZXQgdG1wMzlfOiBmMzIgPSAwLjA7XHJcblxyXG5sZXQgdG1wMjU2MF86IGkzMiA9IDEwMjM7XHJcblxyXG5sZXQgdG1wMjU2NF86IGkzMiA9IDUxMTtcclxuXHJcbmxldCB0bXAyNjc4XzogaTMyID0gOTtcclxuXHJcbmxldCB0bXA0Nl86IGYzMiA9IDEuMDtcclxuXHJcbnZhcjxwcml2YXRlPiBnbG9iYWw6IHZlYzM8dTMyPjtcclxuW1tncm91cCgwKSwgYmluZGluZygwKV1dXHJcbnZhcjxzdG9yYWdlLCByZWFkX3dyaXRlPiByb290X2J1ZmZlcl8wXzogdHlwZV84O1xyXG5cclxuZm4gbWFpbl8xKCkge1xyXG4gICAgdmFyIHBoaV8yOV86IGkzMjtcclxuXHJcbiAgICBsZXQgZV8zNCA9IGdsb2JhbFt0bXAyNDQzX107XHJcbiAgICBwaGlfMjlfID0gKGJpdGNhc3Q8aTMyPihlXzM0KSArIGJlZ2luZV94cHJfdmFsdWUpO1xyXG4gICAgbG9vcCB7XHJcbiAgICAgICAgbGV0IGVfMzkgPSBwaGlfMjlfO1xyXG4gICAgICAgIGlmICgoZV8zOSA8ICh0b3RhbGVfbGVtcyArIGJlZ2luZV94cHJfdmFsdWUpKSkge1xyXG4gICAgICAgICAgICBsZXQgZV80NCA9ICh0bXAyNDQzXyArIChiaXRjYXN0PHUzMj4odG1wMjYyMl8pICogMTA0ODU4NDB1KSk7XHJcbiAgICAgICAgICAgIGxldCBlXzQ5ID0gKChlXzQ0ICsgODM4ODY4OHUpICsgKGJpdGNhc3Q8dTMyPigoKGVfMzkgKyAwKSAmIHRtcDI1NTJfKSkgKiA4dSkpO1xyXG4gICAgICAgICAgICBsZXQgZV81NSA9IHJvb3RfYnVmZmVyXzBfLm1lbWJlclsoKGVfNDkgKyB0bXAyNDQzXykgPj4gYml0Y2FzdDx1MzI+KDJ1KSldO1xyXG4gICAgICAgICAgICBsZXQgZV82MiA9IHJvb3RfYnVmZmVyXzBfLm1lbWJlclsoKGVfNDkgKyA0dSkgPj4gYml0Y2FzdDx1MzI+KDJ1KSldO1xyXG4gICAgICAgICAgICBsZXQgZV83OCA9ICgoZV80NCArIHRtcDI0NDNfKSArIChiaXRjYXN0PHUzMj4oKChpMzIoKCgoYml0Y2FzdDxmMzI+KGVfNjIpICogdG1wMjhfKSArIHRtcDMwXykgKiB0bXAzNF8pKSAmIHRtcDI1NjRfKSArICgoaTMyKChiaXRjYXN0PGYzMj4oZV81NSkgKiB0bXAzMl8pKSAmIHRtcDI1NjBfKSA8PCBiaXRjYXN0PHUzMj4odG1wMjY3OF8pKSkpICogMTZ1KSk7XHJcbiAgICAgICAgICAgIHJvb3RfYnVmZmVyXzBfLm1lbWJlclsoKGVfNzggKyB0bXAyNDQzXykgPj4gYml0Y2FzdDx1MzI+KDJ1KSldID0gYml0Y2FzdDxpMzI+KHRtcDM5Xyk7XHJcbiAgICAgICAgICAgIHJvb3RfYnVmZmVyXzBfLm1lbWJlclsoKGVfNzggKyA0dSkgPj4gYml0Y2FzdDx1MzI+KDJ1KSldID0gYml0Y2FzdDxpMzI+KHRtcDM5Xyk7XHJcbiAgICAgICAgICAgIHJvb3RfYnVmZmVyXzBfLm1lbWJlclsoKGVfNzggKyA4dSkgPj4gYml0Y2FzdDx1MzI+KDJ1KSldID0gYml0Y2FzdDxpMzI+KHRtcDM5Xyk7XHJcbiAgICAgICAgICAgIHJvb3RfYnVmZmVyXzBfLm1lbWJlclsoKGVfNzggKyAxMnUpID4+IGJpdGNhc3Q8dTMyPigydSkpXSA9IGJpdGNhc3Q8aTMyPih0bXA0Nl8pO1xyXG4gICAgICAgICAgICBjb250aW51ZTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICBicmVhaztcclxuICAgICAgICB9XHJcbiAgICAgICAgY29udGludWluZyB7XHJcbiAgICAgICAgICAgIHBoaV8yOV8gPSAoZV8zOSArIHRvdGFsX2ludm9jcyk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgcmV0dXJuO1xyXG59XHJcblxyXG5bW3N0YWdlKGNvbXB1dGUpLCB3b3JrZ3JvdXBfc2l6ZSgxMjgsIDEsIDEpXV1cclxuZm4gbWFpbihbW2J1aWx0aW4oZ2xvYmFsX2ludm9jYXRpb25faWQpXV0gcGFyYW06IHZlYzM8dTMyPikge1xyXG4gICAgZ2xvYmFsID0gcGFyYW07XHJcbiAgICBtYWluXzEoKTtcclxufVxyXG5cclxuYDtcclxuIiwiXCJ1c2Ugc3RyaWN0XCI7XHJcbnZhciBfX2F3YWl0ZXIgPSAodGhpcyAmJiB0aGlzLl9fYXdhaXRlcikgfHwgZnVuY3Rpb24gKHRoaXNBcmcsIF9hcmd1bWVudHMsIFAsIGdlbmVyYXRvcikge1xyXG4gICAgZnVuY3Rpb24gYWRvcHQodmFsdWUpIHsgcmV0dXJuIHZhbHVlIGluc3RhbmNlb2YgUCA/IHZhbHVlIDogbmV3IFAoZnVuY3Rpb24gKHJlc29sdmUpIHsgcmVzb2x2ZSh2YWx1ZSk7IH0pOyB9XHJcbiAgICByZXR1cm4gbmV3IChQIHx8IChQID0gUHJvbWlzZSkpKGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHtcclxuICAgICAgICBmdW5jdGlvbiBmdWxmaWxsZWQodmFsdWUpIHsgdHJ5IHsgc3RlcChnZW5lcmF0b3IubmV4dCh2YWx1ZSkpOyB9IGNhdGNoIChlKSB7IHJlamVjdChlKTsgfSB9XHJcbiAgICAgICAgZnVuY3Rpb24gcmVqZWN0ZWQodmFsdWUpIHsgdHJ5IHsgc3RlcChnZW5lcmF0b3JbXCJ0aHJvd1wiXSh2YWx1ZSkpOyB9IGNhdGNoIChlKSB7IHJlamVjdChlKTsgfSB9XHJcbiAgICAgICAgZnVuY3Rpb24gc3RlcChyZXN1bHQpIHsgcmVzdWx0LmRvbmUgPyByZXNvbHZlKHJlc3VsdC52YWx1ZSkgOiBhZG9wdChyZXN1bHQudmFsdWUpLnRoZW4oZnVsZmlsbGVkLCByZWplY3RlZCk7IH1cclxuICAgICAgICBzdGVwKChnZW5lcmF0b3IgPSBnZW5lcmF0b3IuYXBwbHkodGhpc0FyZywgX2FyZ3VtZW50cyB8fCBbXSkpLm5leHQoKSk7XHJcbiAgICB9KTtcclxufTtcclxuT2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFwiX19lc01vZHVsZVwiLCB7IHZhbHVlOiB0cnVlIH0pO1xyXG5leHBvcnRzLnRyaWFuZ2xlID0gdm9pZCAwO1xyXG5jb25zdCBzaGFkZXJfdmVydF93Z3NsXzEgPSByZXF1aXJlKFwiLi9zaGFkZXIudmVydC53Z3NsXCIpO1xyXG5jb25zdCBzaGFkZXJfZnJhZ193Z3NsXzEgPSByZXF1aXJlKFwiLi9zaGFkZXIuZnJhZy53Z3NsXCIpO1xyXG5sZXQgdHJpYW5nbGUgPSAoY2FudmFzKSA9PiBfX2F3YWl0ZXIodm9pZCAwLCB2b2lkIDAsIHZvaWQgMCwgZnVuY3Rpb24qICgpIHtcclxuICAgIGNvbnN0IGNvbnRleHQgPSBjYW52YXMuZ2V0Q29udGV4dCgnd2ViZ3B1Jyk7XHJcbiAgICBjb25zdCBhZGFwdGVyID0geWllbGQgbmF2aWdhdG9yLmdwdS5yZXF1ZXN0QWRhcHRlcigpO1xyXG4gICAgY29uc3QgZGV2aWNlID0geWllbGQgYWRhcHRlci5yZXF1ZXN0RGV2aWNlKCk7XHJcbiAgICBjb25zdCBwcmVzZW50YXRpb25Gb3JtYXQgPSBjb250ZXh0LmdldFByZWZlcnJlZEZvcm1hdChhZGFwdGVyKTtcclxuICAgIGNvbnN0IHByaW1pdGl2ZVR5cGUgPSAndHJpYW5nbGUtbGlzdCc7XHJcbiAgICBjb250ZXh0LmNvbmZpZ3VyZSh7XHJcbiAgICAgICAgZGV2aWNlLFxyXG4gICAgICAgIGZvcm1hdDogcHJlc2VudGF0aW9uRm9ybWF0LFxyXG4gICAgfSk7XHJcbiAgICBjb25zdCB0cmlhbmdsZVdpZHRoID0gMTtcclxuICAgIGNvbnN0IHRyaWFuZ2xlSGVpZ2h0ID0gMTtcclxuICAgIC8vIHByZXR0aWVyLWlnbm9yZVxyXG4gICAgY29uc3QgdmVydGljZXMgPSBuZXcgRmxvYXQzMkFycmF5KFtcclxuICAgICAgICAwLjAsIHRyaWFuZ2xlSGVpZ2h0IC8gMixcclxuICAgICAgICB0cmlhbmdsZVdpZHRoIC8gMiwgLXRyaWFuZ2xlSGVpZ2h0IC8gMixcclxuICAgICAgICAtdHJpYW5nbGVXaWR0aCAvIDIsIC10cmlhbmdsZUhlaWdodCAvIDIsXHJcbiAgICBdKTtcclxuICAgIGNvbnN0IHZlcnRleEJ1ZmZlciA9IGRldmljZS5jcmVhdGVCdWZmZXIoe1xyXG4gICAgICAgIHNpemU6IHZlcnRpY2VzLmJ5dGVMZW5ndGgsXHJcbiAgICAgICAgdXNhZ2U6IEdQVUJ1ZmZlclVzYWdlLlZFUlRFWCB8IEdQVUJ1ZmZlclVzYWdlLkNPUFlfRFNULFxyXG4gICAgICAgIG1hcHBlZEF0Q3JlYXRpb246IHRydWUsXHJcbiAgICB9KTtcclxuICAgIG5ldyBGbG9hdDMyQXJyYXkodmVydGV4QnVmZmVyLmdldE1hcHBlZFJhbmdlKCkpLnNldCh2ZXJ0aWNlcyk7XHJcbiAgICB2ZXJ0ZXhCdWZmZXIudW5tYXAoKTtcclxuICAgIC8vIHByZXR0aWVyLWlnbm9yZVxyXG4gICAgY29uc3QgY29sb3JzID0gbmV3IEZsb2F0MzJBcnJheShbXHJcbiAgICAgICAgMS4wLCAwLjAsIDAuMCxcclxuICAgICAgICAwLjAsIDEuMCwgMC4wLFxyXG4gICAgICAgIDAuMCwgMC4wLCAxLjBcclxuICAgIF0pO1xyXG4gICAgY29uc3QgY29sb3JzQnVmZmVyID0gZGV2aWNlLmNyZWF0ZUJ1ZmZlcih7XHJcbiAgICAgICAgc2l6ZTogY29sb3JzLmJ5dGVMZW5ndGgsXHJcbiAgICAgICAgdXNhZ2U6IEdQVUJ1ZmZlclVzYWdlLlZFUlRFWCB8IEdQVUJ1ZmZlclVzYWdlLkNPUFlfRFNULFxyXG4gICAgICAgIG1hcHBlZEF0Q3JlYXRpb246IHRydWUsXHJcbiAgICB9KTtcclxuICAgIG5ldyBGbG9hdDMyQXJyYXkoY29sb3JzQnVmZmVyLmdldE1hcHBlZFJhbmdlKCkpLnNldChjb2xvcnMpO1xyXG4gICAgY29sb3JzQnVmZmVyLnVubWFwKCk7XHJcbiAgICBjb25zdCBwaXBlbGluZSA9IGRldmljZS5jcmVhdGVSZW5kZXJQaXBlbGluZSh7XHJcbiAgICAgICAgdmVydGV4OiB7XHJcbiAgICAgICAgICAgIG1vZHVsZTogZGV2aWNlLmNyZWF0ZVNoYWRlck1vZHVsZSh7XHJcbiAgICAgICAgICAgICAgICBjb2RlOiBzaGFkZXJfdmVydF93Z3NsXzEuc2hhZGVyLFxyXG4gICAgICAgICAgICB9KSxcclxuICAgICAgICAgICAgZW50cnlQb2ludDogJ21haW4nLFxyXG4gICAgICAgICAgICBidWZmZXJzOiBbXHJcbiAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgICAgYXJyYXlTdHJpZGU6IDIgKiBGbG9hdDMyQXJyYXkuQllURVNfUEVSX0VMRU1FTlQsXHJcbiAgICAgICAgICAgICAgICAgICAgYXR0cmlidXRlczogW1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzaGFkZXJMb2NhdGlvbjogMCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZvcm1hdDogJ2Zsb2F0MzJ4MicsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBvZmZzZXQ6IDAsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgXSxcclxuICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgICAgYXJyYXlTdHJpZGU6IDMgKiBGbG9hdDMyQXJyYXkuQllURVNfUEVSX0VMRU1FTlQsXHJcbiAgICAgICAgICAgICAgICAgICAgYXR0cmlidXRlczogW1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzaGFkZXJMb2NhdGlvbjogMSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZvcm1hdDogJ2Zsb2F0MzJ4MycsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBvZmZzZXQ6IDAsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgXSxcclxuICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIF0sXHJcbiAgICAgICAgfSxcclxuICAgICAgICBmcmFnbWVudDoge1xyXG4gICAgICAgICAgICBtb2R1bGU6IGRldmljZS5jcmVhdGVTaGFkZXJNb2R1bGUoe1xyXG4gICAgICAgICAgICAgICAgY29kZTogc2hhZGVyX2ZyYWdfd2dzbF8xLnNoYWRlcixcclxuICAgICAgICAgICAgfSksXHJcbiAgICAgICAgICAgIGVudHJ5UG9pbnQ6ICdtYWluJyxcclxuICAgICAgICAgICAgdGFyZ2V0czogW1xyXG4gICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICAgIGZvcm1hdDogcHJlc2VudGF0aW9uRm9ybWF0LFxyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgXSxcclxuICAgICAgICB9LFxyXG4gICAgICAgIHByaW1pdGl2ZToge1xyXG4gICAgICAgICAgICB0b3BvbG9neTogcHJpbWl0aXZlVHlwZSxcclxuICAgICAgICAgICAgc3RyaXBJbmRleEZvcm1hdDogdW5kZWZpbmVkLFxyXG4gICAgICAgIH0sXHJcbiAgICB9KTtcclxuICAgIGNvbnN0IGNvbW1hbmRFbmNvZGVyID0gZGV2aWNlLmNyZWF0ZUNvbW1hbmRFbmNvZGVyKCk7XHJcbiAgICBjb25zdCB0ZXh0dXJlVmlldyA9IGNvbnRleHQuZ2V0Q3VycmVudFRleHR1cmUoKS5jcmVhdGVWaWV3KCk7XHJcbiAgICBjb25zdCByZW5kZXJQYXNzID0gY29tbWFuZEVuY29kZXIuYmVnaW5SZW5kZXJQYXNzKHtcclxuICAgICAgICBjb2xvckF0dGFjaG1lbnRzOiBbXHJcbiAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgIHZpZXc6IHRleHR1cmVWaWV3LFxyXG4gICAgICAgICAgICAgICAgbG9hZFZhbHVlOiBbMC4xLCAwLjEsIDAuMSwgMS4wXSxcclxuICAgICAgICAgICAgICAgIHN0b3JlT3A6ICdzdG9yZScsXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgXSxcclxuICAgIH0pO1xyXG4gICAgcmVuZGVyUGFzcy5zZXRQaXBlbGluZShwaXBlbGluZSk7XHJcbiAgICByZW5kZXJQYXNzLnNldFZlcnRleEJ1ZmZlcigwLCB2ZXJ0ZXhCdWZmZXIpO1xyXG4gICAgcmVuZGVyUGFzcy5zZXRWZXJ0ZXhCdWZmZXIoMSwgY29sb3JzQnVmZmVyKTtcclxuICAgIHJlbmRlclBhc3MuZHJhdygzKTtcclxuICAgIHJlbmRlclBhc3MuZW5kUGFzcygpO1xyXG4gICAgZGV2aWNlLnF1ZXVlLnN1Ym1pdChbY29tbWFuZEVuY29kZXIuZmluaXNoKCldKTtcclxufSk7XHJcbmV4cG9ydHMudHJpYW5nbGUgPSB0cmlhbmdsZTtcclxuIiwiXCJ1c2Ugc3RyaWN0XCI7XHJcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBcIl9fZXNNb2R1bGVcIiwgeyB2YWx1ZTogdHJ1ZSB9KTtcclxuZXhwb3J0cy5zaGFkZXIgPSB2b2lkIDA7XHJcbmV4cG9ydHMuc2hhZGVyID0gYFxyXG5zdHJ1Y3QgSW5wdXQge1xyXG4gIFtbbG9jYXRpb24oMCldXSB2Q29sb3I6IHZlYzM8ZjMyPjtcclxufTtcclxuXHJcbltbc3RhZ2UoZnJhZ21lbnQpXV1cclxuXHJcbmZuIG1haW4gKGlucHV0OiBJbnB1dCkgLT4gW1tsb2NhdGlvbigwKV1dIHZlYzQ8ZjMyPiB7XHJcbiAgcmV0dXJuIHZlYzQ8ZjMyPihpbnB1dC52Q29sb3IsIDEuMCk7XHJcbn1cclxuYDtcclxuIiwiXCJ1c2Ugc3RyaWN0XCI7XHJcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBcIl9fZXNNb2R1bGVcIiwgeyB2YWx1ZTogdHJ1ZSB9KTtcclxuZXhwb3J0cy5zaGFkZXIgPSB2b2lkIDA7XHJcbmV4cG9ydHMuc2hhZGVyID0gYFxyXG5cclxuc3RydWN0IElucHV0IHtcclxuICBbW2xvY2F0aW9uKDApXV0gcG9zaXRpb246IHZlYzQ8ZjMyPjtcclxuICBbW2xvY2F0aW9uKDEpXV0gY29sb3I6IHZlYzM8ZjMyPjtcclxufTtcclxuXHJcbnN0cnVjdCBPdXRwdXQge1xyXG4gIFtbYnVpbHRpbihwb3NpdGlvbildXSBQb3NpdGlvbiA6IHZlYzQ8ZjMyPjtcclxuICBbW2xvY2F0aW9uKDApXV0gdkNvbG9yOiB2ZWMzPGYzMj47XHJcbn07XHJcblxyXG5bW3N0YWdlKHZlcnRleCldXVxyXG5cclxuZm4gbWFpbiAoaW5wdXQ6IElucHV0KSAtPiBPdXRwdXQge1xyXG4gIHZhciBvdXRwdXQ6IE91dHB1dDtcclxuICBcclxuICBvdXRwdXQuUG9zaXRpb24gPSBpbnB1dC5wb3NpdGlvbjtcclxuXHJcbiAgb3V0cHV0LnZDb2xvciA9IGlucHV0LmNvbG9yO1xyXG4gIHJldHVybiBvdXRwdXQ7XHJcbn1cclxuYDtcclxuIiwiXCJ1c2Ugc3RyaWN0XCI7XHJcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBcIl9fZXNNb2R1bGVcIiwgeyB2YWx1ZTogdHJ1ZSB9KTtcclxuZXhwb3J0cy5NYXRyaXggPSBleHBvcnRzLlZlY3RvciA9IGV4cG9ydHMuZmllbGQgPSB2b2lkIDA7XHJcbmNvbnN0IFByb2dyYW1fMSA9IHJlcXVpcmUoXCIuL1Byb2dyYW1cIik7XHJcbmZ1bmN0aW9uIHByb2R1Y3QoZGltZW5zaW9ucykge1xyXG4gICAgbGV0IHNpemUgPSAxO1xyXG4gICAgZm9yIChsZXQgZCBvZiBkaW1lbnNpb25zKSB7XHJcbiAgICAgICAgc2l6ZSA9IHNpemUgKiBkO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIHNpemU7XHJcbn1cclxuZnVuY3Rpb24gZmllbGQoZGltZW5zaW9ucykge1xyXG4gICAgbGV0IHNpemUgPSA0ICogcHJvZHVjdChkaW1lbnNpb25zKTtcclxuICAgIHJldHVybiBQcm9ncmFtXzEucHJvZ3JhbS5wYXJ0aWFsVHJlZS5hZGRGaWVsZChzaXplKTtcclxufVxyXG5leHBvcnRzLmZpZWxkID0gZmllbGQ7XHJcbmxldCBWZWN0b3IgPSB7XHJcbiAgICBmaWVsZDogKG4sIGRpbWVuc2lvbnMpID0+IHtcclxuICAgICAgICBsZXQgc2l6ZSA9IDQgKiBuICogcHJvZHVjdChkaW1lbnNpb25zKTtcclxuICAgICAgICByZXR1cm4gUHJvZ3JhbV8xLnByb2dyYW0ucGFydGlhbFRyZWUuYWRkRmllbGQoc2l6ZSk7XHJcbiAgICB9XHJcbn07XHJcbmV4cG9ydHMuVmVjdG9yID0gVmVjdG9yO1xyXG5sZXQgTWF0cml4ID0ge1xyXG4gICAgZmllbGQ6IChtLCBuLCBkaW1lbnNpb25zKSA9PiB7XHJcbiAgICAgICAgbGV0IHNpemUgPSA0ICogbiAqIG0gKiBwcm9kdWN0KGRpbWVuc2lvbnMpO1xyXG4gICAgICAgIHJldHVybiBQcm9ncmFtXzEucHJvZ3JhbS5wYXJ0aWFsVHJlZS5hZGRGaWVsZChzaXplKTtcclxuICAgIH1cclxufTtcclxuZXhwb3J0cy5NYXRyaXggPSBNYXRyaXg7XHJcbiIsIlwidXNlIHN0cmljdFwiO1xyXG52YXIgX19hd2FpdGVyID0gKHRoaXMgJiYgdGhpcy5fX2F3YWl0ZXIpIHx8IGZ1bmN0aW9uICh0aGlzQXJnLCBfYXJndW1lbnRzLCBQLCBnZW5lcmF0b3IpIHtcclxuICAgIGZ1bmN0aW9uIGFkb3B0KHZhbHVlKSB7IHJldHVybiB2YWx1ZSBpbnN0YW5jZW9mIFAgPyB2YWx1ZSA6IG5ldyBQKGZ1bmN0aW9uIChyZXNvbHZlKSB7IHJlc29sdmUodmFsdWUpOyB9KTsgfVxyXG4gICAgcmV0dXJuIG5ldyAoUCB8fCAoUCA9IFByb21pc2UpKShmdW5jdGlvbiAocmVzb2x2ZSwgcmVqZWN0KSB7XHJcbiAgICAgICAgZnVuY3Rpb24gZnVsZmlsbGVkKHZhbHVlKSB7IHRyeSB7IHN0ZXAoZ2VuZXJhdG9yLm5leHQodmFsdWUpKTsgfSBjYXRjaCAoZSkgeyByZWplY3QoZSk7IH0gfVxyXG4gICAgICAgIGZ1bmN0aW9uIHJlamVjdGVkKHZhbHVlKSB7IHRyeSB7IHN0ZXAoZ2VuZXJhdG9yW1widGhyb3dcIl0odmFsdWUpKTsgfSBjYXRjaCAoZSkgeyByZWplY3QoZSk7IH0gfVxyXG4gICAgICAgIGZ1bmN0aW9uIHN0ZXAocmVzdWx0KSB7IHJlc3VsdC5kb25lID8gcmVzb2x2ZShyZXN1bHQudmFsdWUpIDogYWRvcHQocmVzdWx0LnZhbHVlKS50aGVuKGZ1bGZpbGxlZCwgcmVqZWN0ZWQpOyB9XHJcbiAgICAgICAgc3RlcCgoZ2VuZXJhdG9yID0gZ2VuZXJhdG9yLmFwcGx5KHRoaXNBcmcsIF9hcmd1bWVudHMgfHwgW10pKS5uZXh0KCkpO1xyXG4gICAgfSk7XHJcbn07XHJcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBcIl9fZXNNb2R1bGVcIiwgeyB2YWx1ZTogdHJ1ZSB9KTtcclxuZXhwb3J0cy5wcm9ncmFtID0gZXhwb3J0cy5Qcm9ncmFtID0gdm9pZCAwO1xyXG5jb25zdCBSdW50aW1lXzEgPSByZXF1aXJlKFwiLi4vYmFja2VuZC9SdW50aW1lXCIpO1xyXG5jb25zdCBTTm9kZVRyZWVfMSA9IHJlcXVpcmUoXCIuL1NOb2RlVHJlZVwiKTtcclxuY2xhc3MgUHJvZ3JhbSB7XHJcbiAgICBjb25zdHJ1Y3RvcigpIHtcclxuICAgICAgICB0aGlzLnJ1bnRpbWUgPSBudWxsO1xyXG4gICAgICAgIHRoaXMubWF0ZXJpYWxpemVkVHJlZXMgPSBbXTtcclxuICAgICAgICB0aGlzLnBhcnRpYWxUcmVlID0gbmV3IFNOb2RlVHJlZV8xLlNOb2RlVHJlZSgpO1xyXG4gICAgICAgIHRoaXMucGFydGlhbFRyZWUudHJlZUlkID0gMDtcclxuICAgIH1cclxuICAgIG1hdGVyaWFsaXplUnVudGltZSgpIHtcclxuICAgICAgICByZXR1cm4gX19hd2FpdGVyKHRoaXMsIHZvaWQgMCwgdm9pZCAwLCBmdW5jdGlvbiogKCkge1xyXG4gICAgICAgICAgICB0aGlzLnJ1bnRpbWUgPSBuZXcgUnVudGltZV8xLlJ1bnRpbWUoKTtcclxuICAgICAgICAgICAgeWllbGQgdGhpcy5ydW50aW1lLmluaXQoKTtcclxuICAgICAgICB9KTtcclxuICAgIH1cclxuICAgIG1hdGVyaWFsaXplQ3VycmVudFRyZWUoKSB7XHJcbiAgICAgICAgaWYgKHRoaXMucGFydGlhbFRyZWUuc2l6ZSA9PT0gMCkge1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmICh0aGlzLnJ1bnRpbWUgPT0gbnVsbCkge1xyXG4gICAgICAgICAgICB0aGlzLm1hdGVyaWFsaXplUnVudGltZSgpO1xyXG4gICAgICAgIH1cclxuICAgICAgICB0aGlzLnJ1bnRpbWUubWF0ZXJpYWxpemVUcmVlKHRoaXMucGFydGlhbFRyZWUpO1xyXG4gICAgICAgIHRoaXMubWF0ZXJpYWxpemVkVHJlZXMucHVzaCh0aGlzLnBhcnRpYWxUcmVlKTtcclxuICAgICAgICBsZXQgbmV4dElkID0gdGhpcy5wYXJ0aWFsVHJlZS50cmVlSWQgKyAxO1xyXG4gICAgICAgIHRoaXMucGFydGlhbFRyZWUgPSBuZXcgU05vZGVUcmVlXzEuU05vZGVUcmVlKCk7XHJcbiAgICAgICAgdGhpcy5wYXJ0aWFsVHJlZS50cmVlSWQgPSBuZXh0SWQ7XHJcbiAgICB9XHJcbn1cclxuZXhwb3J0cy5Qcm9ncmFtID0gUHJvZ3JhbTtcclxuY29uc3QgcHJvZ3JhbSA9IG5ldyBQcm9ncmFtKCk7XHJcbmV4cG9ydHMucHJvZ3JhbSA9IHByb2dyYW07XHJcbiIsIlwidXNlIHN0cmljdFwiO1xyXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgXCJfX2VzTW9kdWxlXCIsIHsgdmFsdWU6IHRydWUgfSk7XHJcbmV4cG9ydHMuU05vZGVUcmVlID0gdm9pZCAwO1xyXG5jbGFzcyBTTm9kZVRyZWUge1xyXG4gICAgY29uc3RydWN0b3IoKSB7XHJcbiAgICAgICAgdGhpcy50cmVlSWQgPSAwO1xyXG4gICAgICAgIHRoaXMuZmllbGRzID0gW107XHJcbiAgICAgICAgdGhpcy5zaXplID0gMDtcclxuICAgIH1cclxuICAgIGFkZEZpZWxkKGZpZWxkU2l6ZSkge1xyXG4gICAgICAgIGxldCBmaWVsZCA9IHtcclxuICAgICAgICAgICAgc25vZGVUcmVlOiB0aGlzLFxyXG4gICAgICAgICAgICBvZmZzZXQ6IHRoaXMuc2l6ZSxcclxuICAgICAgICAgICAgc2l6ZTogZmllbGRTaXplXHJcbiAgICAgICAgfTtcclxuICAgICAgICB0aGlzLnNpemUgKz0gZmllbGRTaXplO1xyXG4gICAgICAgIHRoaXMuZmllbGRzLnB1c2goZmllbGQpO1xyXG4gICAgICAgIHJldHVybiBmaWVsZDtcclxuICAgIH1cclxufVxyXG5leHBvcnRzLlNOb2RlVHJlZSA9IFNOb2RlVHJlZTtcclxuIiwiXCJ1c2Ugc3RyaWN0XCI7XHJcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBcIl9fZXNNb2R1bGVcIiwgeyB2YWx1ZTogdHJ1ZSB9KTtcclxuZXhwb3J0cy50YWljaGkgPSB2b2lkIDA7XHJcbmNvbnN0IG1haW5fMSA9IHJlcXVpcmUoXCIuL2V4YW1wbGVzL3RyaWFuZ2xlL21haW5cIik7XHJcbmNvbnN0IG1haW5fMiA9IHJlcXVpcmUoXCIuL2V4YW1wbGVzL2NvbXB1dGVCb2lkcy9tYWluXCIpO1xyXG5jb25zdCBtYWluXzMgPSByZXF1aXJlKFwiLi9leGFtcGxlcy90YWljaGkwL21haW5cIik7XHJcbmNvbnN0IG1haW5fNCA9IHJlcXVpcmUoXCIuL2V4YW1wbGVzL3RhaWNoaTEvbWFpblwiKTtcclxuY29uc3QgbWFpbl81ID0gcmVxdWlyZShcIi4vZXhhbXBsZXMvdGFpY2hpMl92b3J0ZXhfcmluZy9tYWluXCIpO1xyXG5mdW5jdGlvbiBrZXJuZWwoZikge1xyXG4gICAgY29uc29sZS5sb2coZi50b1N0cmluZygpKTtcclxufVxyXG5jb25zdCB0YWljaGkgPSB7XHJcbiAgICBrZXJuZWwsXHJcbiAgICB0cmlhbmdsZTogbWFpbl8xLnRyaWFuZ2xlLFxyXG4gICAgY29tcHV0ZUJvaWRzOiBtYWluXzIuY29tcHV0ZUJvaWRzLFxyXG4gICAgdGFpY2hpRXhhbXBsZTA6IG1haW5fMy50YWljaGlFeGFtcGxlMCxcclxuICAgIHRhaWNoaUV4YW1wbGUxOiBtYWluXzQudGFpY2hpRXhhbXBsZTEsXHJcbiAgICB0YWljaGlFeGFtcGxlMlZvcnRleFJpbmc6IG1haW5fNS50YWljaGlFeGFtcGxlMlZvcnRleFJpbmdcclxufTtcclxuZXhwb3J0cy50YWljaGkgPSB0YWljaGk7XHJcbiIsIlwidXNlIHN0cmljdFwiO1xyXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgXCJfX2VzTW9kdWxlXCIsIHsgdmFsdWU6IHRydWUgfSk7XHJcbmV4cG9ydHMuZGl2VXAgPSB2b2lkIDA7XHJcbmZ1bmN0aW9uIGRpdlVwKGEsIGIpIHtcclxuICAgIHJldHVybiBNYXRoLmNlaWwoYSAvIGIpO1xyXG59XHJcbmV4cG9ydHMuZGl2VXAgPSBkaXZVcDtcclxuIiwiLy8gVGhlIG1vZHVsZSBjYWNoZVxudmFyIF9fd2VicGFja19tb2R1bGVfY2FjaGVfXyA9IHt9O1xuXG4vLyBUaGUgcmVxdWlyZSBmdW5jdGlvblxuZnVuY3Rpb24gX193ZWJwYWNrX3JlcXVpcmVfXyhtb2R1bGVJZCkge1xuXHQvLyBDaGVjayBpZiBtb2R1bGUgaXMgaW4gY2FjaGVcblx0dmFyIGNhY2hlZE1vZHVsZSA9IF9fd2VicGFja19tb2R1bGVfY2FjaGVfX1ttb2R1bGVJZF07XG5cdGlmIChjYWNoZWRNb2R1bGUgIT09IHVuZGVmaW5lZCkge1xuXHRcdHJldHVybiBjYWNoZWRNb2R1bGUuZXhwb3J0cztcblx0fVxuXHQvLyBDcmVhdGUgYSBuZXcgbW9kdWxlIChhbmQgcHV0IGl0IGludG8gdGhlIGNhY2hlKVxuXHR2YXIgbW9kdWxlID0gX193ZWJwYWNrX21vZHVsZV9jYWNoZV9fW21vZHVsZUlkXSA9IHtcblx0XHQvLyBubyBtb2R1bGUuaWQgbmVlZGVkXG5cdFx0Ly8gbm8gbW9kdWxlLmxvYWRlZCBuZWVkZWRcblx0XHRleHBvcnRzOiB7fVxuXHR9O1xuXG5cdC8vIEV4ZWN1dGUgdGhlIG1vZHVsZSBmdW5jdGlvblxuXHRfX3dlYnBhY2tfbW9kdWxlc19fW21vZHVsZUlkXS5jYWxsKG1vZHVsZS5leHBvcnRzLCBtb2R1bGUsIG1vZHVsZS5leHBvcnRzLCBfX3dlYnBhY2tfcmVxdWlyZV9fKTtcblxuXHQvLyBSZXR1cm4gdGhlIGV4cG9ydHMgb2YgdGhlIG1vZHVsZVxuXHRyZXR1cm4gbW9kdWxlLmV4cG9ydHM7XG59XG5cbiIsIlwidXNlIHN0cmljdFwiO1xyXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgXCJfX2VzTW9kdWxlXCIsIHsgdmFsdWU6IHRydWUgfSk7XHJcbmNvbnN0IHRhaWNoaV8xID0gcmVxdWlyZShcIi4vdGFpY2hpXCIpO1xyXG5nbG9iYWxUaGlzLnRhaWNoaSA9IHRhaWNoaV8xLnRhaWNoaTtcclxuIl0sIm5hbWVzIjpbXSwic291cmNlUm9vdCI6IiJ9