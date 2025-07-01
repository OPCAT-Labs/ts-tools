import { assert, expect } from 'chai';
import { getContractFilePath } from '../utils/helper';
import {
  compilerVersion,
  compile,
  findCompiler,
  compileContract,
  compileContractAsync,
  CompileErrorType,
} from '@opcat-labs/scrypt-ts-transpiler-opcat';

import { ABIEntityType } from '@opcat-labs/scrypt-ts-opcat';
describe('compile()', () => {
  it('compile successfully', () => {
    const result = compileContract(getContractFilePath('p2pkh.scrypt'));

    assert.typeOf(result, 'object');
    assert.equal(result.errors.length, 0, 'No Errors');
  });

  it('should generate description file properly', () => {
    const content = compileContract(getContractFilePath('bar.scrypt')).toArtifact();

    assert.deepEqual(content.abi, [
      {
        type: ABIEntityType.FUNCTION,
        name: 'unlock',
        index: 0,
        params: [
          {
            name: 'y',
            type: 'int',
          },
        ],
      },
      {
        type: ABIEntityType.CONSTRUCTOR,
        params: [
          {
            name: '_x',
            type: 'int',
          },
          {
            name: 'y',
            type: 'int',
          },
          {
            name: 'z',
            type: 'int',
          },
        ],
      },
    ]);
  });

  it('should generate structs properly', () => {
    const result = compileContract(getContractFilePath('person.scrypt')).toArtifact();

    assert.equal(result.structs.length, 2);

    expect(result.structs).to.deep.include.members([
      {
        name: 'Person',
        params: [
          {
            name: 'addr',
            type: 'bytes',
          },
          {
            name: 'isMale',
            type: 'bool',
          },
          {
            name: 'age',
            type: 'int',
          },
        ],
        genericTypes: [],
      },
      {
        name: 'Block',
        params: [
          {
            name: 'hash',
            type: 'bytes',
          },
          {
            name: 'header',
            type: 'bytes',
          },
          {
            name: 'time',
            type: 'int',
          },
        ],
        genericTypes: [],
      },
    ]);
  });

  describe('test compilerVersion', () => {
    it('test compilerVersion', () => {
      const scryptc = findCompiler() as string;

      assert.isDefined(scryptc);

      const version = compilerVersion(scryptc) as string;
      expect(/^(\d)+\.(\d)+\.(\d)+\+commit\./.test(version)).to.be.true;
    });
  });

  describe('all param type with const var should be replace with IntLiteral', () => {
    it('result.abi all param type with const var should be replace with IntLiteral', () => {
      const result = compileContract(getContractFilePath('const.scrypt'));
      expect(result.toArtifact().abi).to.deep.include.members([
        {
          type: 'function',
          name: 'unlock',
          index: 0,
          params: [
            {
              name: 'y',
              type: 'int[5]',
            },
            {
              name: 'x',
              type: 'int[3][5]',
            },
            {
              name: 'amounts',
              type: 'int[1]',
            },
          ],
        },
        {
          type: 'constructor',
          params: [
            {
              name: 'memberx',
              type: 'int[1]',
            },
            {
              name: 'membery',
              type: 'int[5]',
            },
          ],
        },
      ]);
      const contracts = result.ast?.contracts;

      expect(result.statics).to.deep.equal([
        { const: true, name: 'Util.DATALEN', type: 'int', value: '5' },
        {
          const: true,
          name: 'Util.BIGINT',
          type: 'int',
          value: '2988348162058574136915891421498819466320163312926952423791023078876139',
        },
        { const: true, name: 'ConstTest.N', type: 'int', value: '3' },
        { const: true, name: 'ConstTest.UU', type: 'int', value: '5' },
        { const: true, name: 'ConstTest.C', type: 'int', value: 'N' },
        {
          const: true,
          name: 'ConstTest.amount',
          type: 'int',
          value: '1',
        },
        {
          const: true,
          name: 'ConstTest.BIGINT',
          type: 'int',
          value: '2988348162058574136915891421498819466320163312926952423791023078876139',
        },
      ]);
    });

    // it('result.abi all param type with alias should be replace with final type', () => {
    //   const result = compileContract(getContractFilePath('mdarray.scrypt')).toArtifact();
    //   expect(result.abi).to.deep.include.members([
    //     {
    //       type: 'function',
    //       name: 'unlock',
    //       index: 0,
    //       params: [
    //         {
    //           name: 'P1',
    //           type: 'int[2][3]',
    //         },
    //         {
    //           name: 'P2',
    //           type: 'int[2]',
    //         },
    //       ],
    //     },
    //     {
    //       type: 'function',
    //       name: 'unlockST1',
    //       index: 1,
    //       params: [
    //         {
    //           name: 'st1array',
    //           type: 'ST1[2]',
    //         },
    //       ],
    //     },
    //     {
    //       type: 'function',
    //       name: 'unlockAliasST2',
    //       index: 2,
    //       params: [
    //         {
    //           name: 'st1array',
    //           type: 'ST2[2]',
    //         },
    //       ],
    //     },
    //     {
    //       type: 'function',
    //       name: 'unlockMDArrayST1',
    //       index: 3,
    //       params: [
    //         {
    //           name: 'st1mdarray',
    //           type: 'ST1[2][2][2]',
    //         },
    //       ],
    //     },
    //     {
    //       type: 'constructor',
    //       params: [
    //         {
    //           name: 'X',
    //           type: 'int[2][3][4]',
    //         },
    //       ],
    //     },
    //   ]);
    // });
  });

  describe('test compileContract', () => {
    it('compile successfully', () => {
      const result = compileContract(getContractFilePath('p2pkh.scrypt')).toArtifact();

      expect(result.hex).to.be.equal('00<pubKeyHash>7778a978886f75ac777777');
    });

    it('compileContractAsync successfully', async () => {
      const result = await compileContractAsync(getContractFilePath('p2pkh.scrypt'));
      expect(result.toArtifact().hex).to.be.equal('00<pubKeyHash>7778a978886f75ac777777');
    });


    it('test_ctc_as_parameter_sub', () => {
      const result = compileContract(getContractFilePath('ctc.scrypt'));

      expect(result.abi).to.deep.equal([
        {
          type: 'function',
          name: 'unlock',
          index: 0,
          params: [
            {
              name: 'st1',
              type: 'St1',
            },
            {
              name: 'st2',
              type: 'St2',
            },
            {
              name: 'a',
              type: 'St1[2]',
            },
            {
              name: 'b',
              type: 'St1[3][2]',
            },
            {
              name: 'c',
              type: 'int[3]',
            },
          ],
        },
        {
          type: 'constructor',
          params: [
            {
              name: 'st1',
              type: 'St1',
            },
            {
              name: 'st2',
              type: 'St2',
            },
            {
              name: 'a',
              type: 'St1[2]',
            },
            {
              name: 'b',
              type: 'St1[3][2]',
            },
            {
              name: 'c',
              type: 'int[3]',
            },
          ],
        },
      ]);

      expect(result.structs).to.deep.equal([
        {
          name: 'St1',
          params: [
            {
              name: 'x',
              type: 'int[3]',
            },
          ],
          genericTypes: [],
        },
        {
          name: 'St2',
          params: [
            {
              name: 'st1s',
              type: 'St1[2]',
            },
          ],
          genericTypes: [],
        },
      ]);

      expect(result.alias).to.deep.equal([
        {
          name: 'St1Array',
          type: 'St1[2]',
        },
      ]);
    });

    it('compile successfully', () => {
      const result = compileContract(getContractFilePath('p2pkh.scrypt'));
      expect(result.statics).to.deep.equal([]);
    });

    it('compile erc20.scrypt with stdout successfully', () => {
      const result = compile(
        { path: getContractFilePath('erc20.scrypt') },
        {
          artifact: false,
          asm: true,
          ast: true,
          debug: false,
          hex: true,
          stdout: true,
          cmdPrefix: findCompiler(),
        },
      );

      expect(result.errors.length === 0).to.true;
    });
  });
});
