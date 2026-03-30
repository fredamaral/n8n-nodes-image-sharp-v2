import sharp, { FormatEnum, OutputInfo, OverlayOptions } from 'sharp';
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

	static async composite(
		baseInput: Buffer,
		images: {
			input: Buffer;
			top: number;
			left: number;
			blend: string;
			size?: {
				width: number;
				height: number;
				fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
			};
		}[],
	) {

		const config = await Promise.all(
			images.map(async (c) => {
				let i = sharp(c.input);

				if (c.size) {
					const metadata = await i.metadata();

					i = sharp(c.input).resize({
						width: c.size.width || metadata.width,
						height: c.size.height || metadata.height,
						fit: c.size.fit || 'cover',
					});
				}

				return {
					input: await i.toBuffer(),
					top: c.top,
					left: c.left,
					blend: c.blend,
				} as OverlayOptions;
			}),
		);

		const compose = await sharp(baseInput).composite(config);

		return await compose.toBuffer({ resolveWithObject: true }).then((n) => {
			return { ...n };
		});
	}
}
