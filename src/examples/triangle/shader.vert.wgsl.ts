export const shader = `

struct Input {
  [[location(0)]] position: vec4<f32>;
  [[location(1)]] color: vec3<f32>;
};

struct Output {
  [[builtin(position)]] Position : vec4<f32>;
  [[location(0)]] vColor: vec3<f32>;
};

[[stage(vertex)]]

fn main (input: Input) -> Output {
  var output: Output;
  
  output.Position = input.position;

  output.vColor = input.color;
  return output;
}
`