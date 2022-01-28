

def main():
    with open("C:/Users/ldfra/Code/Taichi/taichi/build/taichi.js","r") as f:
        code = f.read()
    code += "export {createTaichiModule}\n"
    code = code.replace("f(-1)","")
    with open("src/native/taichi/taichi.js","w") as f:
        f.write(code)

if __name__ == "__main__":
    main()