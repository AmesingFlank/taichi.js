import {shader as VERTEX_SHADER} from './shader.vert.wgsl'
import {shader as FRAGMENT_SHADER} from './shader.frag.wgsl'

let triangle = async (canvas: HTMLCanvasElement) => {

  const context = canvas.getContext('webgpu')

  const adapter = await navigator.gpu.requestAdapter()
  const device = await adapter!.requestDevice()

  const presentationFormat = context!.getPreferredFormat(adapter!)
  const primitiveType = 'triangle-list'

  context!.configure({
    device,
    format: presentationFormat,
  })

  const triangleWidth = 1
  const triangleHeight = 1
  // prettier-ignore
  const vertices = new Float32Array([
    0.0, triangleHeight / 2,
    triangleWidth / 2, -triangleHeight / 2,
    -triangleWidth / 2, -triangleHeight / 2,
  ])
  const vertexBuffer = device.createBuffer({
    size: vertices.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    mappedAtCreation: true,
  })
  new Float32Array(vertexBuffer.getMappedRange()).set(vertices)
  vertexBuffer.unmap()

  // prettier-ignore
  const colors = new Float32Array([
    1.0, 0.0, 0.0, 
    0.0, 1.0, 0.0,
    0.0, 0.0, 1.0
  ])
  const colorsBuffer = device.createBuffer({
    size: colors.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    mappedAtCreation: true,
  })
  new Float32Array(colorsBuffer.getMappedRange()).set(colors)
  colorsBuffer.unmap()

  const pipeline = device.createRenderPipeline({
    vertex: {
      module: device.createShaderModule({
        code: VERTEX_SHADER,
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
        code: FRAGMENT_SHADER,
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
  })
 
 
  const commandEncoder = device.createCommandEncoder()
  const textureView = context!.getCurrentTexture().createView()
  const renderPass = commandEncoder.beginRenderPass({
    colorAttachments: [
      {
        view: textureView,
        loadValue: [0.1, 0.1, 0.1, 1.0],
        loadOp: "clear",
        storeOp: 'store',
      },
    ],
  })
  renderPass.setPipeline(pipeline)
  renderPass.setVertexBuffer(0, vertexBuffer)
  renderPass.setVertexBuffer(1, colorsBuffer)
  renderPass.draw(3)
  renderPass.endPass()

  device.queue.submit([commandEncoder.finish()])
}

export {triangle}