export const shader = `
struct Input {
  [[location(0)]] vColor: vec3<f32>;
};

[[stage(fragment)]]

fn main (input: Input) -> [[location(0)]] vec4<f32> {
  return vec4<f32>(input.vColor, 1.0);
}
`