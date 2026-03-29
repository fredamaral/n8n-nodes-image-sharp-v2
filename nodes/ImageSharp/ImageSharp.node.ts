import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
} from 'n8n-workflow';
import { imageSharpOperations } from './ImageSharpDescription';
import { FormatEnum } from 'sharp';
import path from 'node:path';
import { SharpService } from './sharpService';
import { LoggerProxy as Logger } from 'n8n-workflow';

// const configuredOutputs = (parameters: INodeParameters) => {
// 	//const formats = ((parameters.formats as IDataObject)?.values as IDataObject[]) ?? [];
// 	const formats = (parameters.formats as NodeParameterValue[]) ?? [];
// 	const outputs = formats.map((format, index) => {
// 		return <INodeOutputConfiguration>{
// 			type: `${NodeConnectionType.Main}`,
// 			displayName: format?.toLocaleString()
// 		};
// 	});

// 	return outputs
// }

export class ImageSharp implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Image Sharp V2',
		name: 'imageSharp',
		icon: 'file:imagesharp.svg',
		group: ['transform'],
		version: 1,
		description: 'Execute operations using Sharp',
		defaults: {
			name: 'Image Sharp v2',
		},
		inputs: ['main'],
		//outputs: `={{(${configuredOutputs})($parameter)}}`,
		outputs: ['main'],
		properties: [...imageSharpOperations],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const operation = this.getNodeParameter('operation', 0);

		Logger.info(`operation: ${operation}`);

		switch (operation) {
			case 'generate_svg':
				return ImageSharp.generateImageFromSVG(this);
			case 'optimize':
				return ImageSharp.optimize(this);
			case 'composite':
				return ImageSharp.composite(this);
			default:
				return ImageSharp.optimize(this);
		}
	}

	static async generateImageFromSVG(a: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = a.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				// É assim que você pega o valor do parâmetro 'svgString' para o item atual
				const svgString = a.getNodeParameter('svgString', itemIndex) as string;
				const binaryPropertyName = a.getNodeParameter('binaryPropertyName', itemIndex) as string;

				if (!svgString) {
					throw new NodeOperationError(
						a.getNode(),
						'O parâmetro "SVG String" é obrigatório para esta operação.',
						{ itemIndex },
					);
				}

				const fileName = 'nome-do-arquivo.png'; // Você pode gerar um nome de arquivo dinamicamente

				const info = await SharpService.imageGeneratorFromSVGString(
					svgString,
					fileName, // Você pode gerar um nome de arquivo dinamicamente
					'png', // Você pode adicionar um parâmetro para o usuário escolher o formato
				);

				const binary = await a.helpers.prepareBinaryData(info.data, fileName, 'image/png');

				// Adiciona os dados ao resultado que será retornado para o próximo nó
				returnData.push({
					json: { message: `SVG para o item ${itemIndex} processado.` },
					pairedItem: { item: itemIndex },
					binary: {
						[binaryPropertyName]: binary,
					},
				});
			} catch (error) {
				if (a.continueOnFail()) {
					returnData.push({ json: { error: error.message }, pairedItem: { item: itemIndex } });
					continue;
				}
				throw error;
			}
		}

		return [returnData];
	}

	static async optimize(a: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		let returnData: INodeExecutionData[][] = [];

		const items = a.getInputData();

		let item: INodeExecutionData;
		let binaryPropertyName: string;

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				binaryPropertyName = a.getNodeParameter('binaryPropertyName', itemIndex) as string;
				item = items[itemIndex];

				if (!item.binary)
					throw new NodeOperationError(a.getNode(), `input data required`, { itemIndex });

				const inputData = item.binary[binaryPropertyName];

				if (inputData.fileType && inputData.fileType !== 'image')
					throw new NodeOperationError(
						a.getNode(),
						`unsupported file type: ${inputData.fileType}`,
						{ itemIndex },
					);

				const input = await a.helpers.getBinaryDataBuffer(itemIndex, binaryPropertyName);

				const formats = a.getNodeParameter('formats', itemIndex) as string[];

				if (itemIndex === 0) {
					const nodeOutputs = a.getNodeOutputs();
					returnData = new Array(nodeOutputs.length).fill(0).map(() => []);
				}

				const imageOutputs = await SharpService.optimize(input, formats, itemIndex);

				for await (const imageOutput of imageOutputs) {
					//const outputIndex = formats.indexOf(imageOutput.format)
					const outputIndex = 0;

					if (outputIndex < 0)
						throw new NodeOperationError(
							a.getNode(),
							`output format '${imageOutput.format}' unknown`,
							{ itemIndex },
						);

					let fileName = inputData.fileName;
					let ext = inputData.fileExtension;
					let mimeType = inputData.mimeType;

					switch (<keyof FormatEnum>imageOutput.format) {
						case 'png':
							mimeType = 'image/png';
							ext = 'png';
							break;
						case 'jpeg':
							mimeType = 'image/jpeg';
							ext = 'jpg';
							break;
						case 'webp':
							mimeType = 'image/webp';
							ext = 'webp';
							break;
						case 'avif':
							mimeType = 'image/avif';
							ext = 'avif';
							break;
					}

					if (fileName) {
						const name = path.basename(fileName, path.extname(fileName));
						fileName = `${name}.min.${ext}`;
					}

					const binary = await a.helpers.prepareBinaryData(imageOutput.data, fileName, mimeType);

					returnData[outputIndex].push({
						pairedItem: { item: itemIndex },
						json: { ...imageOutput.info },
						binary: {
							[binaryPropertyName]: binary,
						},
					});
				}
			} catch (error) {
				console.error(error);

				if (a.continueOnFail()) {
					returnData[0].push({ pairedItem: itemIndex, json: { error: error.message } });
				} else {
					if (error.context) {
						error.context.itemIndex = itemIndex;
						throw error;
					}
					throw new NodeOperationError(a.getNode(), error, {
						itemIndex,
					});
				}
			}
		}

		//return this.prepareOutputData(items);

		return returnData;
	}

	static async composite(a: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = a.getInputData();
		const returnData: INodeExecutionData[] = [];

		let item: INodeExecutionData;
		let binaryPropertyName: string;

		const binaries = [];

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				// É assim que você pega o valor do parâmetro 'svgString' para o item atual
				binaryPropertyName = a.getNodeParameter('binaryPropertyName', itemIndex) as string;
				item = items[itemIndex];
				const json = item.json as {
					top: number;
					left: number;
					blend: string;
					size: {
						width: number;
						height: number;
						fit: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
					};
				};

				if (!item.binary)
					throw new NodeOperationError(a.getNode(), `input data required`, { itemIndex });

				const inputData = item.binary[binaryPropertyName];

				if (inputData.fileType && inputData.fileType !== 'image')
					throw new NodeOperationError(
						a.getNode(),
						`unsupported file type: ${inputData.fileType}`,
						{ itemIndex },
					);

				const input = await a.helpers.getBinaryDataBuffer(itemIndex, binaryPropertyName);

				binaries.push({
					buffer: input,
					top: json?.top || 50,
					left: json?.left || 50,
					blend: json?.blend || 'over',
					size: json?.size,
				});
			} catch (error) {
				if (a.continueOnFail()) {
					returnData.push({ json: { error: error.message }, pairedItem: { item: itemIndex } });
					continue;
				}
				throw error;
			}
		}

		const config = binaries.slice(1).map((b) => {
			return {
				input: b.buffer,
				top: b.top,
				left: b.left,
				blend: b.blend,
				size: b.size,
			};
		});

		const imageGerada = await SharpService.composite(binaries[0].buffer, config);

		const binary = await a.helpers.prepareBinaryData(
			imageGerada.data,
			'composite.png',
			'image/png',
		);

		returnData.push({
			pairedItem: { item: 0 },
			json: { ...imageGerada.info },
			binary: {
				data: binary,
			},
		});

		return [returnData];
	}
}
