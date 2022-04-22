import { Vertex } from "./Vertex";
import { Scene } from "./Scene"
import { Material } from "./Material";
import { Texture } from "../../data/Texture";
class Parser {
    static beginsWith(line: string, firstWord: string) {
        let words = line.trim().split(" ").filter(x => x.length !== 0);
        return words[0] === firstWord;
    }
    static tailWords(line: string) {
        let words = line.trim().split(" ").filter(x => x.length !== 0);
        return words.splice(1);
    }
    static lastWord(line: string) {
        let tailWords = this.tailWords(line)
        return tailWords[tailWords.length - 1]
    }
    static expandToVecN(v: number[], n: number) {
        let result = [];
        for (let i = 0; i < n; i++) {
            if (i < v.length) {
                result.push(v[i]);
            }
            else result.push(0);
        }
        return result;
    }
    static stringArrayToVec(stringArray: string[], n: number) {
        return Parser.expandToVecN(stringArray.slice(0, n).map(x => parseFloat(x)), n);
    }
}

export class ObjLoader {

    static async loadFromURL(url: string): Promise<Scene> {
        let response = await fetch(url)
        let objString: string = await response.text()
        let resultScene = new Scene()

        let urlParts = url.split("/")
        let baseURL = urlParts.slice(0, urlParts.length - 1).join("/") + "/";

        let lines = objString.split("\n");
        let texCoords = [];
        let normals = [];

        let currentMaterialId = 0

        for (let l = 0; l < lines.length; ++l) {
            let thisLine = lines[l];
            let tailWords = Parser.tailWords(thisLine);
            if (Parser.beginsWith(thisLine, "mtllib")) {
                let materialFileName = tailWords[0];
                let materialURL = baseURL + materialFileName
                let materials = await MtlLoader.loadFromURL(materialURL)
                resultScene.materials = resultScene.materials.concat(materials)
            }
            else if (Parser.beginsWith(thisLine, "g") || Parser.beginsWith(thisLine, "o")) {

            }
            else if (Parser.beginsWith(thisLine, "v")) {
                let pos = Parser.stringArrayToVec(tailWords, 3);
                let newVertex = this.getNewVertex(pos, currentMaterialId)
                resultScene.vertices.push(newVertex)
            }
            else if (Parser.beginsWith(thisLine, "vt")) {
                texCoords.push(Parser.stringArrayToVec(tailWords, 2));
            }
            else if (Parser.beginsWith(thisLine, "vn")) {
                normals.push(Parser.stringArrayToVec(tailWords, 3));
            }
            else if (Parser.beginsWith(thisLine, "usemtl")) {
                let materialName = tailWords[0];
                let found = false
                for (let i = 0; i < resultScene.materials.length; ++i) {
                    if (resultScene.materials[i].name === materialName) {
                        found = true
                        currentMaterialId = i
                        break
                    }
                }
                if (!found) {
                    throw `the material ${materialName} cannot be found`
                }
            }
            else if (Parser.beginsWith(thisLine, "f")) {
                let newIndices = [];
                let vertexStrings = tailWords;
                for (let v = 0; v < vertexStrings.length; ++v) {
                    let thisVertexString = vertexStrings[v];
                    let propertiesStr = thisVertexString.split("/");
                    let properties = propertiesStr.map(x => parseInt(x) - 1);
                    let vertexID = properties[0];
                    newIndices[v] = vertexID;
                    if (properties.length >= 2 && propertiesStr[1].length !== 0) {
                        resultScene.vertices[vertexID].texCoords = texCoords[properties[1]];
                    }
                    if (properties.length === 3) {
                        resultScene.vertices[vertexID].normal = normals[properties[2]];
                    }
                }
                resultScene.indices.push(newIndices[0])
                resultScene.indices.push(newIndices[1])
                resultScene.indices.push(newIndices[2])
                if (newIndices.length === 4) {
                    resultScene.indices.push(newIndices[0])
                    resultScene.indices.push(newIndices[2])
                    resultScene.indices.push(newIndices[3])
                }
            }

        }
        return resultScene
    }

    static getNewVertex(position: number[], materialID: number): Vertex {
        return {
            position,
            normal: [0, 0, 0],
            texCoords: [0, 0],
            materialID,
        }
    }
}



export class MtlLoader {
    static async loadFromURL(url: string): Promise<Material[]> {
        let response = await fetch(url)
        let mtlString: string = await response.text()
        let materials: Material[] = []

        let urlParts = url.split("/")
        let baseURL = urlParts.slice(0, urlParts.length - 1).join("/") + "/";

        let lines = mtlString.split("\n");
        let currentMaterial : Material|null = null;
        for (let l = 0; l < lines.length; ++l) {
            let thisLine = lines[l];
            let tailWords = Parser.tailWords(thisLine);
            if (Parser.beginsWith(thisLine, "newmtl")) {
                if (currentMaterial != null) {
                    materials.push(currentMaterial)
                }
                let thisMaterialName = tailWords[0];
                currentMaterial = new Material(materials.length);
                currentMaterial.name = thisMaterialName
            }
            else if (Parser.beginsWith(thisLine, "Kd")) {
                let color = Parser.stringArrayToVec(tailWords, 4)
                if(tailWords.length === 3){
                    color[3] = 1
                }
                currentMaterial!.baseColor.value = color;
            }
            else if (Parser.beginsWith(thisLine, "map_Kd")) {
                let fileName = Parser.lastWord(thisLine)
                let url = baseURL + fileName
                let texture = await Texture.createFromURL(url)
                currentMaterial!.baseColor.texture = texture
            } 
        }
        if (currentMaterial != null) {
            materials.push(currentMaterial)
        }
        return materials;
    }
}