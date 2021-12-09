import {shader as init0} from './init0.wgsl'
import {program} from '../../program/Program'
import {field,Vector,Matrix}  from '../../program/FieldsFactory'

let taichiExample1 = async () => {

  await program.materializeRuntime()
  let x = field([10])
  program.materializeCurrentTree()

  let initKernel = program.runtime!.createKernel([{
    code: init0,
    invocatoions: 10
  }])

  program.runtime!.launchKernel(initKernel)
  await program.runtime!.sync()
  let rootBufferCopy = await program.runtime!.copyRootBufferToHost(0)
  console.log("Example 1 results:")
  console.log(rootBufferCopy)
}

export {taichiExample1}