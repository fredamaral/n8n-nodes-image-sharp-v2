import sharp, { FormatEnum, OutputInfo } from 'sharp';
import { optimizeDefaults } from './ImageSharpDefaults';

export class SharpService {
	static async imageGeneratorFromSVGString(
		svg: string,
		fileName: string,
		format: 'png' | 'jpg' | 'webp',
	) {
		const s = sharp(Buffer.from(svg));
		let buffer;

		switch (format) {
			case 'png':
				buffer = s.png();
				break;
			case 'jpg':
				buffer = s.jpeg();
				break;
			case 'webp':
				buffer = s.webp();
				break;
		}

		return await buffer.toBuffer({ resolveWithObject: true }).then((n) => {
			return { format, ...n };
		});
	}

	static async optimize(input: Buffer, formats: string[], itemIndex: number) {
		const imageOutputs: Promise<{ format: string; data: Buffer; info: OutputInfo }>[] = [];

		const imgSharp = sharp(input);

		for (const format of formats) {
			let pipe = imgSharp;

			switch (<keyof FormatEnum>format) {
				case 'png':
					pipe = pipe.png(optimizeDefaults.png);
					break;
				case 'jpeg':
					pipe = pipe.jpeg(optimizeDefaults.jpeg);
					break;
				case 'webp':
					pipe = pipe.webp(optimizeDefaults.webp);
					break;
				case 'avif':
					pipe = pipe.avif(optimizeDefaults.avif);
					break;
				default:
					throw new Error(`unsupported image format '${format}'`);
			}

			const r = pipe.toBuffer({ resolveWithObject: true }).then((n) => {
				return { format, ...n };
			});

			imageOutputs.push(r);
		}

		return imageOutputs;
	}
}
