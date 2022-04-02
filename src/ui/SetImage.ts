import { Field } from "../data/Field"
import { Program } from "../program/Program"

const vertShader = `
struct StageInput {
  @location(0) position: vec2<f32>;
};

struct StageOutput {
  @builtin(position) Position : vec4<f32>;
  @location(5) fragPos: vec2<f32>;
};

@stage(vertex)

fn main (input: StageInput) -> StageOutput {
  var output: StageOutput;
  
  output.Position = vec4<f32>(input.position,0.0,1.0);
  output.fragPos = vec2<f32>(input.position) ;
  return output;
}
`

export const fragShader = `
struct StageInput {
  @location(5) fragPos: vec2<f32>;
};
struct StageOutput {
  @location(0) color: vec4<f32>;
};

struct RootBufferType {
    member: array<f32>;
};

@group(0) @binding(0)
var<storage, read_write> rootBuffer: RootBufferType;

struct UniformBufferType {
  width : i32;
  height : i32;
  offset: i32;
};

@group(0) @binding(1)
var<uniform> ubo : UniformBufferType;


@stage(fragment)
fn main (input: StageInput) -> StageOutput {
    var fragPos = input.fragPos;
    fragPos = (fragPos + 1.0 ) / 2.0 ;
    
    var working = vec4<f32>(fragPos,0.0, 1.0);

    var cellPos = vec2<i32>(i32(fragPos.x*f32(ubo.width)), i32(fragPos.y*f32(ubo.height)));
    var pixelIndex = cellPos.x * ubo.height + cellPos.y;
    //pixelIndex = cellPos.y * ubo.width + cellPos.x;
    var result = vec4<f32>(
        (rootBuffer.member[ubo.offset + pixelIndex * 4 + 0]),
        (rootBuffer.member[ubo.offset + pixelIndex * 4 + 1]),
        (rootBuffer.member[ubo.offset + pixelIndex * 4 + 2]),
        (rootBuffer.member[ubo.offset + pixelIndex * 4 + 3])
    );
    var output: StageOutput;
    output.color = result;
    return output;
}
`

class SetImage {
    adapter: GPUAdapter
    device: GPUDevice
 
    context: GPUCanvasContext|null = null

    vertexBuffer:GPUBuffer|null = null
    uniformBuffer:GPUBuffer|null = null
    pipeline:GPURenderPipeline|null = null
    presentationFormat: GPUTextureFormat|null = null
 
    constructor(public htmlCanvas: HTMLCanvasElement){
        this.adapter = Program.getCurrentProgram().runtime!.adapter!
        this.device = Program.getCurrentProgram().runtime!.device! 
        this.initForCanvas()
    }
    initForCanvas(){
      this.context = this.htmlCanvas.getContext('webgpu') 
      this.presentationFormat = this.context!.getPreferredFormat(this.adapter)

      this.context!.configure({
          device: this.device,
          format: this.presentationFormat,
      })
      this.init()
    }
    init(){
        const vertices = new Float32Array([
            -1,-1,
            1,1,
            1,-1,
            -1,-1,
            -1,1,
            1,1
        ])
        this.vertexBuffer = this.device.createBuffer({
            size: vertices.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true,
        })
        new Float32Array(this.vertexBuffer!.getMappedRange()).set(vertices)
        this.vertexBuffer!.unmap()

        this.uniformBuffer = this.device.createBuffer({
            size: vertices.byteLength,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            mappedAtCreation: false,
        })
      
    
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
              code: fragShader,
            }),
            entryPoint: 'main',
            targets: [
              {
                format: this.presentationFormat!,
              },
            ],
          },
          primitive: {
            topology:'triangle-list',
            stripIndexFormat: undefined,
          },
        })
 
    }

    render(image:Field){
        let bindGroup = this.device.createBindGroup({
            layout: this.pipeline!.getBindGroupLayout(0),
            entries: [
                {
                    binding: 0,
                    resource: {
                        buffer: Program.getCurrentProgram().runtime!.getRootBuffer(image.snodeTree.treeId),
                    },
                },
                {
                    binding: 1,
                    resource: {
                        buffer: this.uniformBuffer!
                    },
                },
            ],
        })
        this.device!.queue.writeBuffer(
            this.uniformBuffer!,
            0,
            new Int32Array([
                image.dimensions[0], image.dimensions[1], image.offsetBytes/4
            ])
        );
        const commandEncoder = this.device!.createCommandEncoder();
        {
            const renderPassDescriptor: GPURenderPassDescriptor = {
                colorAttachments: [
                    {
                        view: this.context!.getCurrentTexture().createView(),
                        loadValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
                        loadOp: "clear",
                        storeOp: 'store',
                    },
                ],
            };
            const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
            passEncoder.setPipeline(this.pipeline!);
            passEncoder.setVertexBuffer(0, this.vertexBuffer!);
            passEncoder.setBindGroup(0, bindGroup)
            passEncoder.draw(6,1, 0, 0);
            passEncoder.endPass();
        }
        this.device.queue.submit([commandEncoder.finish()]);
    }

    
}

export {SetImage }