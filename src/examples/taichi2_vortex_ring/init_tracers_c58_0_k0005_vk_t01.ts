
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
    var x_95 : i32;
    let ii : i32 = ii_phi;
    if ((ii < end_)) {
    } else {
      break;
    }
    let tmp35 : i32 = (ii + 0);
    let tmp421 : i32 = (tmp35 / 258);
    let tmp39 : i32 = (tmp35 - ((tmp421 + ((-(select(0, 1, (-(select(0, 1, (tmp35 < 0))) != 0))) & -(select(0, 1, (tmp35 != 0)))) & -(select(0, 1, ((tmp421 * 258) != tmp35))))) * 258));
    let tmp360 : u32 = (((0u + (bitcast<u32>(0) * 10485840u)) + 8388688u) + (bitcast<u32>((tmp35 & 262143)) * 8u));
    root_buffer_0_1.field0[bitcast<u32>((bitcast<i32>((tmp360 + 0u)) >> 2u))] = ((f32(tmp39) * 0.003875969) - 0.5);
    root_buffer_0_1.field0[bitcast<u32>((bitcast<i32>((tmp360 + 4u)) >> 2u))] = ((f32(i32((f32((tmp35 - tmp39)) * 0.003875969))) * 0.003875969) - 1.5);

    continuing {
      x_95 = (ii + 200064);
      ii_phi = x_95;
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
            