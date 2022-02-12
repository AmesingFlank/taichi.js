def main():
    with open("lib/ti.js","r", errors='ignore') as f:
        code = f.readlines()
        source_map_prefix = "//# sourceMappingURL="
        if code[-1][:len(source_map_prefix)] == source_map_prefix:
            code = code[:-1]
    with open("lib/ti.js","w", errors='ignore') as f:
        f.writelines(code)

if __name__ == "__main__":
    main()