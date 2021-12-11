
export const shader = `
type RTArr = [[stride(4)]] array<i32>;

[[block]]
struct S {
  field0 : RTArr;
};

type RTArr_1 = [[stride(4)]] array<f32>;

[[block]]
struct S_1 {
  field0 : RTArr_1;
};

var<private> x_16 : vec3<u32>;

[[group(0), binding(0)]] var<storage, read_write> root_buffer_0 : S;

[[group(0), binding(0)]] var<storage, read_write> root_buffer_0_1 : S_1;

fn main_1() {
  var ii_phi : i32;
  let x_20 : u32 = x_16.x;
  let x_21 : i32 = bitcast<i32>(x_20);
  ii_phi = x_21;
  loop {
    var x_76 : i32;
    let ii : i32 = ii_phi;
    if ((ii < 524288)) {
    } else {
      break;
    }

    continuing {
      let x_53 : u32 = (bitcast<u32>(((ii & 511) + (((ii >> bitcast<u32>(9)) & 1023) << bitcast<u32>(9)))) * 16u);
      root_buffer_0_1.field0[bitcast<u32>((bitcast<i32>(x_53) >> 2u))] = 1.0;
      root_buffer_0_1.field0[bitcast<u32>((bitcast<i32>((x_53 + 4u)) >> 2u))] = 1.0;
      root_buffer_0_1.field0[bitcast<u32>((bitcast<i32>((x_53 + 8u)) >> 2u))] = 1.0;
      root_buffer_0_1.field0[bitcast<u32>((bitcast<i32>((x_53 + 12u)) >> 2u))] = 1.0;
      x_76 = (ii + 524288);
      ii_phi = x_76;
    }
  }
  return;
}

[[stage(compute), workgroup_size(128, 1, 1)]]
fn main([[builtin(global_invocation_id)]] x_16_param : vec3<u32>) {
  x_16 = x_16_param;
  main_1();
}

`
            