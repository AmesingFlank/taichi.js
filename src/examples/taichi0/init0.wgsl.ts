export const shader = `
[[block]]
struct type_7 {
    member: [[stride(4)]] array<i32>;
};

[[group(0), binding(0)]]
var<storage, read_write> root_buffer_0_: type_7;

[[block]]
struct type_8 {
    member: [[stride(4)]] array<atomic<i32>>;
};

[[group(0), binding(1)]]
var<storage, read_write> root_buffer_1_: type_8;


[[stage(compute), workgroup_size(128, 1, 1)]]
fn main([[builtin(global_invocation_id)]] param: vec3<u32>) {
    if(param[0]==0u){
        root_buffer_0_.member[0] = 1;
        let res = atomicAdd(&(root_buffer_1_.member[0]),1);
        root_buffer_0_.member[1] = root_buffer_0_.member[0];
        root_buffer_0_.member[2] = res;
    }
}
`