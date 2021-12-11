
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
  let begin_ : i32 = (bitcast<i32>(x_20) + 0);
  let end_ : i32 = (4 + 0);
  ii_phi = begin_;
  loop {
    var x_75 : i32;
    let ii : i32 = ii_phi;
    if ((ii < end_)) {
    } else {
      break;
    }
    let tmp2404 : u32 = (0u + (bitcast<u32>(0) * 10485840u));
    let tmp2480 : i32 = ((ii + 0) & 3);
    let tmp2408 : u32 = ((tmp2404 + 8388640u) + (bitcast<u32>(tmp2480) * 8u));
    let tmp71 : f32 = root_buffer_0_1.field0[bitcast<u32>((bitcast<i32>((tmp2408 + 0u)) >> 2u))];
    let tmp2418 : u32 = ((tmp2404 + 8388608u) + (bitcast<u32>(tmp2480) * 8u));
    root_buffer_0_1.field0[bitcast<u32>((bitcast<i32>((tmp2418 + 0u)) >> 2u))] = tmp71;
    let tmp75 : f32 = root_buffer_0_1.field0[bitcast<u32>((bitcast<i32>((tmp2408 + 4u)) >> 2u))];
    root_buffer_0_1.field0[bitcast<u32>((bitcast<i32>((tmp2418 + 4u)) >> 2u))] = tmp75;

    continuing {
      x_75 = (ii + 128);
      ii_phi = x_75;
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
            