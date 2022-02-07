import {shader as init0} from './init0.wgsl'
import {Program} from '../../program/Program'
import {field,Vector,Matrix}  from '../../api/Fields'
import {init} from '../../api/Init'
import {PrimitiveType} from "../../frontend/Type"
import {BufferType, BufferBinding, KernelParams} from "../../backend/Kernel"

let taichiExample1 = async () => {
  await init()
  let program = Program.getCurrentProgram()
  await program.materializeRuntime()
  let x = field( PrimitiveType.i32, [10])
  program.materializeCurrentTree()

  let bindings = [new BufferBinding(BufferType.Root,0,0)]
  let initKernel = program.runtime!.createKernel(new KernelParams([{
    code: init0,
    workgroupSize: 128,
    rangeHint:"10",
    bindings
  }]))

  program.runtime!.launchKernel(initKernel)
  await program.runtime!.sync()
  let rootBufferCopy = await program.runtime!.copyFieldToHost(x)
  console.log("Example 1 results:")
  console.log(rootBufferCopy)
}

export {taichiExample1}