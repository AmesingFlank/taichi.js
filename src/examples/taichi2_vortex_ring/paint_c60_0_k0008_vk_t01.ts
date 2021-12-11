
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
  let end_ : i32 = (200000 + 0);
  ii_phi = begin_;
  loop {
    var x_101 : i32;
    let ii : i32 = ii_phi;
    if ((ii < end_)) {
    } else {
      break;
    }
    let tmp2812 : u32 = (0u + (bitcast<u32>(0) * 10485840u));
    let tmp2816 : u32 = ((tmp2812 + 8388688u) + (bitcast<u32>(((ii + 0) & 262143)) * 8u));
    let tmp25 : f32 = root_buffer_0_1.field0[bitcast<u32>((bitcast<i32>((tmp2816 + 0u)) >> 2u))];
    let tmp27 : f32 = root_buffer_0_1.field0[bitcast<u32>((bitcast<i32>((tmp2816 + 4u)) >> 2u))];
    let tmp2838 : u32 = ((tmp2812 + 0u) + (bitcast<u32>(((i32((((tmp27 * 0.100000001) + 0.5) * 512.0)) & 511) + ((i32((tmp25 * 51.200000763)) & 1023) << bitcast<u32>(9)))) * 16u));
    root_buffer_0_1.field0[bitcast<u32>((bitcast<i32>((tmp2838 + 0u)) >> 2u))] = 0.0;
    root_buffer_0_1.field0[bitcast<u32>((bitcast<i32>((tmp2838 + 4u)) >> 2u))] = 0.0;
    root_buffer_0_1.field0[bitcast<u32>((bitcast<i32>((tmp2838 + 8u)) >> 2u))] = 0.0;
    root_buffer_0_1.field0[bitcast<u32>((bitcast<i32>((tmp2838 + 12u)) >> 2u))] = 1.0;

    continuing {
      x_101 = (ii + 200064);
      ii_phi = x_101;
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
            