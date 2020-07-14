import { isDate, isNumber, isString, isNumberString } from '@st-lib/is';

export type RequiredKeys<T> = {
	[K in keyof T]-?: T[K] extends (string | number | boolean | object | null) ? K : never
}[keyof T];

export type NonNullableKeys<T> = {
	[K in keyof T]-?: T[K] extends (string | number | boolean | object) ? K : never
}[keyof T];

export type OptionalKeys<T> = Exclude<keyof T, RequiredKeys<T>>;

export type ArrayFieldScheme<T> = [
	{ [K in keyof T]-?: ObjectFormSchemeEntry<T, K> }[keyof T]
];

export type ObjectFormSchemeEntry<T, K extends keyof T> =
	K extends NonNullableKeys<Record<K, Exclude<T[K], undefined>>>
	? RequiredFieldSheme<NonNullable<T[K]>>
	: NullableFieldScheme<NonNullable<T[K]>>;

export type ObjectFieldScheme<T> = {
	[K in keyof T]: ObjectFormSchemeEntry<T, K>
};

export type RequiredFieldSheme<T> =
	T extends string ? 'string' :
	T extends number ? 'number' :
	T extends boolean ? 'boolean' :
	T extends Date ? 'date' :
	T extends File ? 'file' :
	T extends (infer R)[] ? ArrayFieldScheme<Record<number, R>> :
	T extends object ? ObjectFieldScheme<T> :
	never;

export type NullableFieldScheme<T> =
	T extends string ? 'string?' :
	T extends number ? 'number?' :
	T extends boolean ? 'boolean?' :
	T extends Date ? 'date?' :
	T extends File ? 'file?' :
	T extends (infer R)[] ? ArrayFieldScheme<Record<number, R>> | null :
	T extends object ? ObjectFieldScheme<T> | null :
	never;

export interface ScalarFormField<T, V> {
	(): V | null;
	(newValue: V | null): void;
	readonly type: T;
	readonly required: boolean;
	readonly path: readonly (string | number)[];
}

export interface ArrayFormField<V> {
	(): V[];
	(newValue: V[] | null): void;
	readonly type: 'array';
	readonly path: readonly (string | number)[];
	[Symbol.iterator](): Generator<FormField<V>>;
	splice(from: number, count?: number, ...values: V[]): V[];
	pop(): V;
	shift(): V;
	push(...items: V[]): number;
	unshift(...items: V[]): number;
	map<R>(cb: (field: FormField<V>, index: number) => R): R[];
	forEach(cb: (field: FormField<V>, index: number) => void): void;
}

export type ObjectFormField<T> = {
	[K in keyof T]: FormField<T[K]>
};

export type FormField<T> =
	T extends string ? ScalarFormField<'string', T> :
	T extends number ? ScalarFormField<'number', string> :
	T extends boolean ? ScalarFormField<'boolean', T> :
	T extends Date ? ScalarFormField<'date', T> :
	T extends File ? ScalarFormField<'file', T> :
	T extends (infer R)[] ? ArrayFormField<R> :
	T extends object ? ObjectFormField<T> :
	never;

export type FormInit<T> =
	T extends boolean ? T | null :
	T extends string | number ? T | string | null :
	T extends Date ? Date | string | number | null :
	T extends File ? File | null :
	T extends (infer R)[] ? FormInit<R>[] :
	T extends object ? { [K in keyof T]+?: FormInit<T[K]> } :
	never;

function isFile(it: any): it is File {
	return typeof it === 'object'
		&& null != it
		&& typeof it.stream === 'function'
		&& typeof it.arrayBuffer === 'function'
		&& typeof it.lastModified === 'number'
		&& typeof it.name === 'string'
		&& typeof it.size === 'number'
		&& typeof it.slice === 'function'
		&& typeof it.text === 'function'
		&& typeof it.type === 'string';
}

function createScalarField<T, V>(
	type: T,
	path: (string | number)[],
	required: boolean,
	value: V | null,
	setValue: (value: V | null) => void,
): ScalarFormField<T, V> {
	function field(): V;
	function field(newValue: V): V;
	function field(...args: any[]) {
		if (args.length) {
			setValue(args[0]);
			return args[0];
		}
		return value;
	}
	field.type = type;
	field.path = path;
	field.required = required;
	return field;
}

function createObjectField(
	type: Record<any, any>,
	path: (string | number)[],
	value: unknown,
	setValue: (value: any) => void,
) {
	const o: Record<any, any> = {};
	const v: Record<any, any> = typeof value === 'object' && null != value ? value : {};
	for (const key in type) {
		o[key] = createField(type[key], path.concat(key), v[key], (value) => {
			v[key] = value;
			setValue(v);
		});
	}
	return o;
}

function createArrayField(
	[type]: any[],
	path: (string | number)[],
	value: unknown,
	setValue: (value: any) => any,
): ArrayFormField<any> {
	const v: any[] = Array.isArray(value) ? value : [];
	function field(): any;
	function field(newValue: any): any;
	function field(...args: any[]) {
		if (args.length) {
			setValue(args[0]);
			return args[0];
		}
		return v;
	}
	const fields = v.map((value, index) => createField(type, path.concat(index), value, (newValue) => {
		v[index] = newValue;
		setValue(v);
	}));
	field.path = path;
	field.map = <R>(cb: (field: any, index: number) => R) => {
		return fields.map(cb);
	};
	field.forEach = (cb: (field: any, index: number) => void) => {
		fields.forEach(cb);
	};
	field.splice = (from: number, deleteCount: number = 0, ...items: any[]) => {
		const o = v.splice(from, deleteCount, ...items);
		field(v);
		return o;
	};
	field.push = (...items: any[]) => {
		const o = v.push(...items);
		field(v);
		return o;
	};
	field.unshift = (...items: any[]) => {
		const o = v.unshift(...items);
		field(v);
		return o;
	};
	field.pop = () => {
		const o = v.pop();
		field(v);
		return o;
	};
	field.shift = () => {
		const o = v.shift();
		field(v);
		return o;
	};
	field[Symbol.iterator] = function* () { yield* fields; };
	field.type = 'array' as const;
	return field;
}

function date(inp: unknown) {
	let o: Date | null = null;
	if (isDate(inp)) return inp;
	if (isNumber(inp) || isNumberString(inp)) {
		o = new Date(+inp);
	} else if (isString(inp)) {
		o = new Date(inp);
	}
	return isDate(o) ? o : null;
}

function createField(
	type: unknown,
	path: (string | number)[],
	value: unknown,
	setValue: (value: any) => void,
) {
	switch (type) {
		case 'string':
		case 'string?':
			return createScalarField('string', path, 'string' === type, isString(value) || isNumber(value) || isDate(value) ? String(value) : null, setValue);
		case 'number':
		case 'number?':
			return createScalarField('number', path, 'number' === type, isNumber(value) ? value.toString() : isString(value) ? value : null, setValue);
		case 'boolean':
		case 'boolean?':
			return createScalarField('boolean', path, 'boolean' === type, typeof value === 'boolean' ? value : value instanceof Boolean ? value.valueOf() : null, setValue);
		case 'date':
		case 'date?':
			return createScalarField('date', path, 'date' === type, date(value), setValue);
		case 'file':
		case 'file?':
			return createScalarField('file', path, 'file' === type, isFile(value) ? value : null, setValue);
		default:
			if (Array.isArray(type)) {
				return createArrayField(type, path, value, setValue);
			} else if (typeof type === 'object' && null != type) {
				return createObjectField(type, path, value, setValue);
			} else throw new Error(`unexpected field type ${type}`);
	}
}

function noop() { }


export function createForm<T extends object>(scheme: ObjectFieldScheme<T>) {
	return (data: FormInit<T>, setData: (data: T) => void = noop): ObjectFormField<T> => {
		return createObjectField(
			scheme,
			[],
			data,
			setData,
		) as any;
	};
}

function getNumberFieldData(field: ScalarFormField<'number', string>) {
	const val = field();
	if (isNumberString(val)) {
		return +val;
	} else if (field.required) {
		throw Error(`field ${field.path.join('.')} is required; got ${JSON.stringify(val)}`);
	}
	return null;
}
function getStringFieldData(field: ScalarFormField<'string', string>) {
	const val = field();
	if (null == val && field.required) {
		throw Error(`field ${field.path.join('.')} is required; got ${JSON.stringify(val)}`);
	}
	return val;
}
function getBooleanFieldData(field: ScalarFormField<'boolean', boolean>) {
	const val = field();
	if (null == val && field.required) {
		throw Error(`field ${field.path.join('.')} is required; got ${JSON.stringify(val)}`);
	}
	return val;
}
function getFileFieldData(field: ScalarFormField<'file', File>) {
	const val = field();
	if (isFile(val)) {
		return val;
	} else if (field.required) {
		throw Error(`field ${field.path.join('.')} is required; got ${JSON.stringify(val)}`);
	}
	return null;
}
function getDateFieldData(field: ScalarFormField<'date', Date>) {
	const val = field();
	if (isDate(val)) {
		return val;
	} else if (field.required) {
		throw Error(`field ${field.path.join('.')} is required; got ${JSON.stringify(val)}`);
	}
	return null;
}
function getArrayFieldData<T>(field: ArrayFormField<T>): T[] {
	return field.map(getFieldData);
}

function getFieldData(field: FormField<any>): any {
	if (typeof field === 'function') {
		switch (field.type) {
			case 'number': return getNumberFieldData(field);
			case 'string': return getStringFieldData(field);
			case 'boolean': return getBooleanFieldData(field);
			case 'date': return getDateFieldData(field);
			case 'file': return getFileFieldData(field);
			case 'array': return getArrayFieldData(field);
		}
	} else if (typeof field === 'object' && null != field) {
		return getObjectFieldData(field);
	}
	throw new Error(`unexpected field ${typeof field}`);
}

function getObjectFieldData(field: ObjectFormField<Record<string, any>>) {
	const o: Record<any, any> = {};
	for (const key in field) {
		o[key] = getFieldData(field[key]);
	}
	return o;
}

export function getFormData<T>(fields: ObjectFormField<T>): T {
	return getObjectFieldData(fields);
}
