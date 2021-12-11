
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
  var tmp10 : f32;
  var tmp11 : f32;
  var tmp56 : f32;
  var tmp57 : f32;
  var tmp100 : f32;
  var tmp101 : f32;
  var ii_phi : i32;
  let x_20 : u32 = x_16.x;
  let x_21 : i32 = bitcast<i32>(x_20);
  ii_phi = x_21;
  loop {
    var x_289 : f32;
    var x_288 : f32;
    var x_291 : f32;
    var x_290 : f32;
    var x_299 : f32;
    var x_298 : f32;
    var x_284 : i32;
    var x_289_phi : f32;
    var x_288_phi : f32;
    var tmp14_phi : i32;
    var x_291_phi : f32;
    var x_290_phi : f32;
    var tmp58_phi : i32;
    var x_299_phi : f32;
    var x_298_phi : f32;
    var tmp102_phi : i32;
    let ii : i32 = ii_phi;
    if ((ii < 200000)) {
    } else {
      break;
    }
    let x_52 : u32 = (bitcast<u32>((ii & 262143)) * 8u);
    let x_62 : ptr<storage, f32, read_write> = &(root_buffer_0_1.field0[bitcast<u32>((bitcast<i32>((8388688u + x_52)) >> 2u))]);
    let tmp7 : f32 = *(x_62);
    let x_67 : ptr<storage, f32, read_write> = &(root_buffer_0_1.field0[bitcast<u32>((bitcast<i32>((x_52 + 8388692u)) >> 2u))]);
    let tmp9 : f32 = *(x_67);
    tmp10 = 0.0;
    tmp11 = 0.0;
    x_289_phi = 0.0;
    x_288_phi = 0.0;
    tmp14_phi = 0;
    loop {
      var x_129 : i32;
      x_289 = x_289_phi;
      x_288 = x_288_phi;
      let tmp14 : i32 = tmp14_phi;
      if ((tmp14 < 4)) {
      } else {
        break;
      }

      continuing {
        let x_84 : u32 = bitcast<u32>((tmp14 & 3));
        let x_85 : u32 = (x_84 * 8u);
        let tmp17 : f32 = root_buffer_0_1.field0[bitcast<u32>((bitcast<i32>((8388608u + x_85)) >> 2u))];
        let tmp18 : f32 = (tmp7 - tmp17);
        let tmp20 : f32 = root_buffer_0_1.field0[bitcast<u32>((bitcast<i32>((x_85 + 8388612u)) >> 2u))];
        let tmp21 : f32 = (tmp9 - tmp20);
        let tmp25 : f32 = sqrt(((tmp18 * tmp18) + (tmp21 * tmp21)));
        let tmp26 : f32 = (tmp25 * tmp25);
        let tmp29 : f32 = root_buffer_0_1.field0[bitcast<u32>((bitcast<i32>((8388672u + (x_84 * 4u))) >> 2u))];
        let tmp32 : f32 = (tmp26 * 3.141592741);
        let tmp37 : f32 = -(tmp26);
        let tmp40 : f32 = (1.0 - exp((tmp26 * -10000.0)));
        let tmp44 : f32 = (x_288 + ((((tmp29 * (tmp20 - tmp9)) / tmp32) * 0.5) * tmp40));
        tmp10 = tmp44;
        let tmp47 : f32 = (x_289 + ((((tmp29 * tmp18) / tmp32) * 0.5) * tmp40));
        tmp11 = tmp47;
        x_129 = (tmp14 + 1);
        x_289_phi = tmp47;
        x_288_phi = tmp44;
        tmp14_phi = x_129;
      }
    }
    let tmp54 : f32 = (tmp7 + (x_288 * 0.050000001));
    let tmp55 : f32 = (tmp9 + (x_289 * 0.050000001));
    tmp56 = 0.0;
    tmp57 = 0.0;
    x_291_phi = 0.0;
    x_290_phi = 0.0;
    tmp58_phi = 0;
    loop {
      var x_192 : i32;
      x_291 = x_291_phi;
      x_290 = x_290_phi;
      let tmp58 : i32 = tmp58_phi;
      if ((tmp58 < 4)) {
      } else {
        break;
      }

      continuing {
        let x_148 : u32 = bitcast<u32>((tmp58 & 3));
        let x_149 : u32 = (x_148 * 8u);
        let tmp61 : f32 = root_buffer_0_1.field0[bitcast<u32>((bitcast<i32>((8388608u + x_149)) >> 2u))];
        let tmp62 : f32 = (tmp54 - tmp61);
        let tmp64 : f32 = root_buffer_0_1.field0[bitcast<u32>((bitcast<i32>((x_149 + 8388612u)) >> 2u))];
        let tmp65 : f32 = (tmp55 - tmp64);
        let tmp69 : f32 = sqrt(((tmp62 * tmp62) + (tmp65 * tmp65)));
        let tmp70 : f32 = (tmp69 * tmp69);
        let tmp73 : f32 = root_buffer_0_1.field0[bitcast<u32>((bitcast<i32>((8388672u + (x_148 * 4u))) >> 2u))];
        let tmp76 : f32 = (tmp70 * 3.141592741);
        let tmp81 : f32 = -(tmp70);
        let tmp84 : f32 = (1.0 - exp((tmp70 * -10000.0)));
        let tmp88 : f32 = (x_290 + ((((tmp73 * (tmp64 - tmp55)) / tmp76) * 0.5) * tmp84));
        tmp56 = tmp88;
        let tmp91 : f32 = (x_291 + ((((tmp73 * tmp62) / tmp76) * 0.5) * tmp84));
        tmp57 = tmp91;
        x_192 = (tmp58 + 1);
        x_291_phi = tmp91;
        x_290_phi = tmp88;
        tmp58_phi = x_192;
      }
    }
    let tmp98 : f32 = (tmp7 + (x_290 * 0.075000003));
    let tmp99 : f32 = (tmp9 + (x_291 * 0.075000003));
    tmp100 = 0.0;
    tmp101 = 0.0;
    x_299_phi = 0.0;
    x_298_phi = 0.0;
    tmp102_phi = 0;
    loop {
      var x_255 : i32;
      x_299 = x_299_phi;
      x_298 = x_298_phi;
      let tmp102 : i32 = tmp102_phi;
      if ((tmp102 < 4)) {
      } else {
        break;
      }

      continuing {
        let x_211 : u32 = bitcast<u32>((tmp102 & 3));
        let x_212 : u32 = (x_211 * 8u);
        let tmp105 : f32 = root_buffer_0_1.field0[bitcast<u32>((bitcast<i32>((8388608u + x_212)) >> 2u))];
        let tmp106 : f32 = (tmp98 - tmp105);
        let tmp108 : f32 = root_buffer_0_1.field0[bitcast<u32>((bitcast<i32>((x_212 + 8388612u)) >> 2u))];
        let tmp109 : f32 = (tmp99 - tmp108);
        let tmp113 : f32 = sqrt(((tmp106 * tmp106) + (tmp109 * tmp109)));
        let tmp114 : f32 = (tmp113 * tmp113);
        let tmp117 : f32 = root_buffer_0_1.field0[bitcast<u32>((bitcast<i32>((8388672u + (x_211 * 4u))) >> 2u))];
        let tmp120 : f32 = (tmp114 * 3.141592741);
        let tmp125 : f32 = -(tmp114);
        let tmp128 : f32 = (1.0 - exp((tmp114 * -10000.0)));
        let tmp132 : f32 = (x_298 + ((((tmp117 * (tmp108 - tmp99)) / tmp120) * 0.5) * tmp128));
        tmp100 = tmp132;
        let tmp135 : f32 = (x_299 + ((((tmp117 * tmp106) / tmp120) * 0.5) * tmp128));
        tmp101 = tmp135;
        x_255 = (tmp102 + 1);
        x_299_phi = tmp135;
        x_298_phi = tmp132;
        tmp102_phi = x_255;
      }
    }
    *(x_62) = (tmp7 + ((((x_288 * 0.222222224) + (x_290 * 0.333333343)) + (x_298 * 0.444444448)) * 0.100000001));
    *(x_67) = (tmp9 + ((((x_289 * 0.222222224) + (x_291 * 0.333333343)) + (x_299 * 0.444444448)) * 0.100000001));

    continuing {
      x_284 = (ii + 200064);
      ii_phi = x_284;
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
            