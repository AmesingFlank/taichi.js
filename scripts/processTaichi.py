

def main():
    with open("src/taichi_emscriptened/taichi.js","r") as f:
        code = f.read()
    code += "export {createTaichiModule}\n"
    code = code.replace("f(-1)","")
    with open("src/taichi_emscriptened/taichi.js","w") as f:
        f.write(code)

if __name__ == "__main__":
    main()