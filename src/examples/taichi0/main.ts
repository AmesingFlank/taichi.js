import {shader as init0} from './init0.wgsl'

let taichiExample0 = async () => {

  const adapter = await navigator.gpu.requestAdapter();
  const device = await adapter!.requestDevice();

  const computePipeline = device.createComputePipeline({
    compute: {
      module: device.createShaderModule({
        code: init0,
      }),
      entryPoint: 'main',
    },
  });

  const rootBuffer = device.createBuffer({
    size: 1024,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
  });

  const bindGroup: GPUBindGroup  = device.createBindGroup({
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
    passEncoder.dispatch(1,1,1);
    passEncoder.endPass();
  }
  
  device.queue.submit([commandEncoder.finish()]);
  await device.queue.onSubmittedWorkDone()
  
  const rootBufferCopy = device.createBuffer({
    size: 1024,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
  });
  commandEncoder = device.createCommandEncoder();
  commandEncoder.copyBufferToBuffer(rootBuffer,0,rootBufferCopy,0,1024)
  device.queue.submit([commandEncoder.finish()]);
  await device.queue.onSubmittedWorkDone()

  await rootBufferCopy.mapAsync(GPUMapMode.READ)
  let result = new Int32Array(rootBufferCopy.getMappedRange())
  console.log("Example 0 results:")
  console.log(result)
  rootBufferCopy.unmap()
}

export {taichiExample0}