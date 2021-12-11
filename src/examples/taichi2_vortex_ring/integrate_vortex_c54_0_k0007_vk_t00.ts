
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
  var tmp7 : f32;
  var tmp8 : f32;
  var ii_phi : i32;
  let x_20 : u32 = x_16.x;
  let x_21 : i32 = bitcast<i32>(x_20);
  ii_phi = x_21;
  loop {
    var x_175 : f32;
    var x_174 : f32;
    var x_170 : i32;
    var x_175_phi : f32;
    var x_174_phi : f32;
    var tmp11_phi : i32;
    let ii : i32 = ii_phi;
    if ((ii < 4)) {
    } else {
      break;
    }
    tmp7 = 0.0;
    tmp8 = 0.0;
    x_175_phi = 0.0;
    x_174_phi = 0.0;
    tmp11_phi = 0;
    loop {
      var tmp48 : f32;
      var tmp51 : f32;
      var x_135 : i32;
      var x_177_phi : f32;
      var x_176_phi : f32;
      x_175 = x_175_phi;
      x_174 = x_174_phi;
      let tmp11 : i32 = tmp11_phi;
      if ((tmp11 < 4)) {
      } else {
        break;
      }
      if (((-(select(0, 1, (ii != tmp11))) & 1) != 0)) {
        let x_72 : u32 = (bitcast<u32>((ii & 3)) * 8u);
        let tmp17 : f32 = root_buffer_0_1.field0[bitcast<u32>((bitcast<i32>((8388608u + x_72)) >> 2u))];
        let tmp19 : f32 = root_buffer_0_1.field0[bitcast<u32>((bitcast<i32>((x_72 + 8388612u)) >> 2u))];
        let x_90 : u32 = bitcast<u32>((tmp11 & 3));
        let x_91 : u32 = (x_90 * 8u);
        let tmp21 : f32 = root_buffer_0_1.field0[bitcast<u32>((bitcast<i32>((8388608u + x_91)) >> 2u))];
        let tmp22 : f32 = (tmp17 - tmp21);
        let tmp24 : f32 = root_buffer_0_1.field0[bitcast<u32>((bitcast<i32>((x_91 + 8388612u)) >> 2u))];
        let tmp25 : f32 = (tmp19 - tmp24);
        let tmp29 : f32 = sqrt(((tmp22 * tmp22) + (tmp25 * tmp25)));
        let tmp30 : f32 = (tmp29 * tmp29);
        let tmp33 : f32 = root_buffer_0_1.field0[bitcast<u32>((bitcast<i32>((8388672u + (x_90 * 4u))) >> 2u))];
        let tmp36 : f32 = (tmp30 * 3.141592741);
        let tmp41 : f32 = -(tmp30);
        let tmp44 : f32 = (1.0 - exp((tmp30 * -10000.0)));
        tmp48 = (x_174 + ((((tmp33 * (tmp24 - tmp19)) / tmp36) * 0.5) * tmp44));
        tmp7 = tmp48;
        tmp51 = (x_175 + ((((tmp33 * tmp22) / tmp36) * 0.5) * tmp44));
        tmp8 = tmp51;
        x_177_phi = tmp51;
        x_176_phi = tmp48;
      } else {
        x_177_phi = x_175;
        x_176_phi = x_174;
      }
      let x_177 : f32 = x_177_phi;
      let x_176 : f32 = x_176_phi;

      continuing {
        x_135 = (tmp11 + 1);
        x_175_phi = x_177;
        x_174_phi = x_176;
        tmp11_phi = x_135;
      }
    }
    let x_147 : u32 = (bitcast<u32>((ii & 3)) * 8u);
    let tmp59 : f32 = root_buffer_0_1.field0[bitcast<u32>((bitcast<i32>((8388608u + x_147)) >> 2u))];
    let tmp62 : f32 = root_buffer_0_1.field0[bitcast<u32>((bitcast<i32>((x_147 + 8388612u)) >> 2u))];
    root_buffer_0_1.field0[bitcast<u32>((bitcast<i32>((8388640u + x_147)) >> 2u))] = (tmp59 + (x_174 * 0.100000001));
    root_buffer_0_1.field0[bitcast<u32>((bitcast<i32>((x_147 + 8388644u)) >> 2u))] = (tmp62 + (x_175 * 0.100000001));

    continuing {
      x_170 = (ii + 128);
      ii_phi = x_170;
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
            