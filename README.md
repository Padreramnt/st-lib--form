# Form build tool

## Basic usage

### 1. Create form

```ts
export declare function createForm<T extends object>(scheme: ObjectFieldScheme<T>): (data: FormInit<T>, setData?: (data: T) => void) => ObjectFormField<T>;
```

___scheme___: accepts object, depends on template type T

___returns___: form fields create function.

Scheme must describe actual form data type.

Scheme mappings:
* `string` or string constants (`'1'`, `'2'`, e.t.) -> `'string'`
* `number` -> `'number'`
* `boolean` -> `'boolean'`
* `Date` -> `'date'`
* `File` -> `'file'`
* `object` -> `{ [K in keyof T]: Scheme<T[K]> }`,
* `(infer R)[]` -> `[Scheme<R>]`
* `string | null` or string constants (`'1'`, `'2'`, e.t.) -> `'string?'`
* `number | null` -> `'number?'`
* `boolean | null` -> `'boolean?'`
* `Date | null` -> `'date?'`
* `File | null` -> `'file?'`
* `object | null` -> `{ [K in keyof T]: Scheme<T[K]> } | null`,
* `(infer R)[] | null` -> `[Scheme<R>] | null`

### 2. Get form data from fields

> Note: field value type is different from form data because of `Number('1230000000000000000000000').toString()/*'1.23e+24'*/ !== '1230000000000000000000000'`, Empty input should emit `null` value

Use `getFormData` helper to get actual values.

> Note: `getFormData` will throw error if value cannot be converted: `null` cannot be converted to `'string'`, but allowed with `'string?'`.

```ts
export declare function getFormData<T>(fields: ObjectFormField<T>): T;
```

___fields___: accepts form fields object.

___returns___: parsed form data

### Use form

```tsx
import { createForm, getFormData, FormInit } from '@st-lib/form'

// describe form data
interface LoginFormData {
	email: string
	password: string
	confirm: string
}

// create form with specified form data type
const loginForm = createForm<LoginFormData>({
	email: 'string',
	password: 'string',
	confirm: 'string',
})

// use created form data
// ~ with React

function LoginForm() {
  const [data, setData] = useState<FormInit<LoginFormData>>({});
  const fields = loginForm(data, setData);
  return (
    <form onSubmit={e => {
      e.preventDefault();
      console.log(getFormData(fields));
      setData({});
    }}>
      <input
        type='email'
        name='email'
        value={fields.email() || ''}
        onChange={e => fields.email(e.currentTarget.value)}
        placeholder='password'
        required={fields.email.required}
      />
      <input
        type='password'
        name='password'
        value={fields.password() || ''}
        onChange={e => fields.password(e.currentTarget.value)}
        required={fields.password.required}
      />
      <input
        type='password'
        name='confirm'
        pattern={fields.password()?.replace(/[\[\]\(\)]/g, (str) => '\\' + str)}
        value={fields.confirm() || ''}
        onChange={e => fields.confirm(e.currentTarget.value)}
        title='Confirm password'
        required={fields.confirm.required}
      />
    </form>
  );
}

// ~ with @st-lib/render
// see @st-lib/render-form

function LoginForm(key: any) {
  return form(key, () => {
    const [data, setData] = useState<FormInit<LoginFormData>>({
      email: '123@qwe.c',
      password: '123',
    });
    const fields = loginForm(data, setData);
    onSubmit(e => {
      e.preventDefault();
      console.log(data, getFormData(fields));
      setData({});
    });
    stringField(null, fields.email, {
      type: 'email',
      placeholder: 'email',
    });
    stringField(null, fields.password, {
      type: 'password',
      placeholder: 'password',
    });
    stringField(null, fields.confirm, {
      type: 'password',
      placeholder: 'confirm',
      pattern: fields.password()?.replace(/[\[\]\(\)]/g, str => '\\' + str),
      title: 'Confirm password'
    });
    button(null, () => {
      text(null, 'submit');
    });
  });
}
```

### Field types

#### Scalar field

Used to manipulate scalar values (`string`, `boolean`, `Date`, `File`).

```ts
export interface ScalarFormField<T, V> {
    (): V | null;
    (newValue: V | null): void;
    readonly type: T;
    readonly required: boolean;
    readonly path: readonly (string | number)[];
}
```

Call without args to get field value

```ts
const emailValue = fields.email()
```

Call with arg to set field value, passed value will instantly returned
```ts
const newEmailValue = fields.email('new@email.value')
```

___type___: depends on field`s scheme, see scheme mappings

___required___: allows `null` field value, see scheme mappings

___path___: field path, like `['root', 'key1', 'key2', 'fieldname']`
> Note: ArrayFormField always add index to field path

#### Array field

Used to manipulate array values.

> Note: changes the array instead of creating a new one

```ts
export interface ArrayFormField<V> {
    (): V[];
    (newValue: V[] | null): void;
    readonly type: 'array';
    readonly path: readonly (string | number)[];
    [Symbol.iterator](): Generator<FormField<V>>;
    forEach(cb: (field: FormField<V>, index: number) => void): void;
    map<R>(cb: (field: FormField<V>, index: number) => R): R[];
    pop(): V;
    push(...items: V[]): number;
    shift(): V;
    splice(from: number, count?: number, ...values: V[]): V[];
    unshift(...items: V[]): number;
}
```

Call without args to get field value

```ts
const tagListValues = fields.tagList()
```

Call with arg to set field value, passed value will instantly returned
```ts
const newTagListValues = fields.tagList(['ts-lib', 'render', 'form'])
```

___type___: always equal to `'array'`, used to differ from scalar fields

___path___: field path, like `['root', 'key1', 'key2', 'fieldname']`

___\[Symbol.iterator\]()___: used to enumerate generated fields for values

___map()___: helper method, alias for `Array.from(fields.arrayField).map(() => { /* do something */ })`

___forEach()___: helper method, alias for `Array.from(fields.arrayField).forEach(() => { /* do something */ })`

___splice()___, ___pop()___, ___push()___, ___shift()___, ___unshift()___: helper method to mutate field value, equal to `field.method = (...args) => {const o = fieldValue.method(...args); field(fieldValue); return o;}`


```tsx
interface TagsFormData {
	tagList: string[]
}

const tagsForm = createForm<TagsFormData>({
	tagList: ['string']
})

// ~ with React
fields.tagList.map(field => (
	<input
		key={field.path.join()}
		name={field.path.join('.')}
		required={field.required}
		value={field() || ''}
		onChange={e => field(e.currentTarget.value)}
	/>
))

// ~ with @st-lib/render
for (const tagListField of fields.tagList) {
	stringField(null, tagListField)
}
```


### Object field

> Note: fields change the object instead of creating a new one

```ts
export declare type ObjectFormField<T> = {
    [K in keyof T]: FormField<T[K]>;
};
```
Used as regular object =).

```ts
interface ObjectExampleFormData {
	object: {
		string: string
		number: number
	}
}

const objectExampleForm = createForm<ObjectExampleFormData>({
	object: {
		string: 'string',
		number: 'number',
	}
})
/* ... */
const [data, setData] = useState<FormInit<ObjectExampleFormData>>({})
/* ... */
fields.object.string()
// to set object data in one operation use your `setData` function
setData({ object: { string: '', number: 123456 } })
```
