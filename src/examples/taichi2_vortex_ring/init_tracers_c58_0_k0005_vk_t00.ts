
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

var<private> x_15 : vec3<u32>;

[[group(0), binding(0)]] var<storage, read_write> root_buffer_0 : S;

[[group(0), binding(0)]] var<storage, read_write> root_buffer_0_1 : S_1;

fn main_1() {
  let x_18 : u32 = x_15.x;
  if ((x_18 == 0u)) {
    root_buffer_0_1.field0[2097152u] = 0.0;
    root_buffer_0_1.field0[2097153u] = 1.0;
    root_buffer_0_1.field0[2097154u] = 0.0;
    root_buffer_0_1.field0[2097155u] = -1.0;
    root_buffer_0_1.field0[2097156u] = 0.0;
    root_buffer_0_1.field0[2097157u] = 0.300000012;
    root_buffer_0_1.field0[2097158u] = 0.0;
    root_buffer_0_1.field0[2097159u] = -0.300000012;
    root_buffer_0_1.field0[2097168u] = 1.0;
    root_buffer_0_1.field0[2097169u] = -1.0;
    root_buffer_0_1.field0[2097170u] = 1.0;
    root_buffer_0_1.field0[2097171u] = -1.0;
  }
  return;
}

[[stage(compute), workgroup_size(1, 1, 1)]]
fn main([[builtin(global_invocation_id)]] x_15_param : vec3<u32>) {
  x_15 = x_15_param;
  main_1();
}

`
            