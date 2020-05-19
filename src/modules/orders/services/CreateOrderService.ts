import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateProductService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,

    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,

    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customer = await this.customersRepository.findById(customer_id);
    if (!customer) throw new AppError('Consumidor inexistente');

    const productsFound = await this.productsRepository.findAllById(products);
    if (!productsFound) throw new AppError('Produtos não localizados');

    if (productsFound.length !== products.length)
      throw new AppError('Algum produto não é válido');

    const productsToOrder = productsFound.map(productFromDB => {
      const idFound = products.findIndex(
        productFind => productFind.id === productFromDB.id,
      );

      if (productFromDB.quantity < products[idFound].quantity)
        throw new AppError('Número de itens excede a quantidade disponível');

      const { quantity } = products[idFound];

      const productToOrder = {
        ...productFromDB,
        product_id: productFromDB.id,
        quantity,
        quantityLeft: productFromDB.quantity - quantity,
      };

      return productToOrder;
    });

    const order = await this.ordersRepository.create({
      customer,
      products: productsToOrder,
    });

    const newProductList = productsToOrder.map(product => ({
      ...product,
      quantity: product.quantityLeft,
    }));

    await this.productsRepository.updateQuantity(newProductList);

    return order;
  }
}

export default CreateProductService;
