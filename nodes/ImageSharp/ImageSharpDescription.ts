import { INodeProperties } from 'n8n-workflow';

const optimizeOperation: INodeProperties[] = [
	{
		displayName: 'Max File Size',
		name: 'maxFileSize',
		type: 'number',
		displayOptions: {
			show: {
				operation: ['optimize'],
			},
		},
		default: undefined,
		description: 'Max file size in bytes',
	},
	{
		displayName: 'Output Formats',
		name: 'formats',
		type: 'multiOptions',
		displayOptions: {
			show: {
				operation: ['optimize'],
			},
		},
		options: [
			{
				name: 'Png',
				value: 'png',
			},
			{
				name: 'Jpeg',
				value: 'jpeg',
			},
			{
				name: 'Webp',
				value: 'webp',
			},
			{
				name: 'Avif',
				value: 'avif',
			},
		],
		default: ['png', 'jpeg'],
		required: true,
		description: 'The image output formats',
	},
];

const generateFromSVGOperation: INodeProperties[] = [
	{
		displayName: 'SVG String',
		name: 'svgString',
		required: true,
		type: 'string',
		displayOptions: {
			show: {
				operation: ['generate_svg'],
			},
		},
		default: '',
		description: 'String contento o svg',
	},
];

export const imageSharpOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		options: [
			{
				name: 'OPTIMIZE',
				value: 'optimize',
				description: 'Optimize and limit an image size',
				action: 'Optimize an image',
			},
			{
				name: 'GENERATE FROM SVG',
				value: 'generate_svg',
				description: 'Generate image from SVG',
				action: 'Generate image from SVG',
			},
		],
		default: 'optimize',
	},
	{
		displayName: 'Input Binary Field',
		name: 'binaryPropertyName',
		type: 'string',		
		default: 'data',
		placeholder: '',
		required: true,
		description: 'The name of the input binary field containing the image',
	},
	...optimizeOperation,
	...generateFromSVGOperation,
];
