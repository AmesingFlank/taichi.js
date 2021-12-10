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
`

export const fragShader = `
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

    var cellPos = vec2<i32>(i32(fragPos.x*f32(ubo.width)), i32(fragPos.x*f32(ubo.height)));
    var pixelIndex = cellPos.x * ubo.height + cellPos.y;
    var result = vec4<f32>(
        (rootBuffer.member[pixelIndex * 4 + 0]),
        (rootBuffer.member[pixelIndex * 4 + 1]),
        (rootBuffer.member[pixelIndex * 4 + 2]),
        (rootBuffer.member[pixelIndex * 4 + 3])
    );

    //result = vec4<f32>(f32(pixelIndex)/500000.0, 0.0,0.0, 1.0) + 0.01 * result / (result + 0.01);

    return result;
}
`

class RootBufferRenderer {
    adapter: GPUAdapter
    device: GPUDevice
    buffer: GPUBuffer

    context: GPUCanvasContext|null = null

    vertexBuffer:GPUBuffer|null = null
    uniformBuffer:GPUBuffer|null = null
    pipeline:GPURenderPipeline|null = null
    presentationFormat: GPUTextureFormat|null = null
    bindGroup:GPUBindGroup|null = null

    constructor(adapter: GPUAdapter, device: GPUDevice, buffer: GPUBuffer){
        this.adapter = adapter
        this.device = device
        this.buffer = buffer
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
        })
    }

    async render(width: number, height:number){
        this.device!.queue.writeBuffer(
            this.uniformBuffer!,
            0,
            new Int32Array([
                width,height
            ])
        );
        const commandEncoder = this.device!.createCommandEncoder();
        {
            const renderPassDescriptor: GPURenderPassDescriptor = {
                colorAttachments: [
                    {
                        view: this.context!.getCurrentTexture().createView(),
                        loadValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
                        storeOp: 'store',
                    },
                ],
            };
            const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
            passEncoder.setPipeline(this.pipeline!);
            passEncoder.setVertexBuffer(0, this.vertexBuffer!);
            passEncoder.setBindGroup(0,this.bindGroup!)
            passEncoder.draw(6,1, 0, 0);
            passEncoder.endPass();
        }
        this.device.queue.submit([commandEncoder.finish()]);
        await this.device.queue.onSubmittedWorkDone()
    }

    async initForCanvas(canvas: HTMLCanvasElement){
        this.context = canvas.getContext('webgpu') 
        this.presentationFormat = this.context!.getPreferredFormat(this.adapter)

        this.context!.configure({
            device: this.device,
            format: this.presentationFormat,
        })
        this.init()
    }
}

export {RootBufferRenderer}